import { create } from "zustand";

import { createCognitoAuth, type CognitoAuth } from "./cognito";
import { clearTokens, loadTokens, saveIdToken, saveTokens } from "./tokenStorage";

export type SessionStatus = "restoring" | "signedOut" | "signedIn";

export type SessionState = {
  status: SessionStatus;
  idToken: string | null;
  /** Loads the stored session once at startup. */
  restore: () => Promise<void>;
  /** Throws AuthError when Cognito rejects the credentials. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Resolves true when a fresh ID token is stored; otherwise signs out and resolves false. */
  refresh: () => Promise<boolean>;
};

export function createSessionStore(auth: CognitoAuth) {
  // Several queries can hit a 401 at once; they all wait on the same Cognito request.
  let refreshing: Promise<boolean> | null = null;
  // Bumped on every sign-in and sign-out. A refresh started in an earlier session must not touch
  // the current one, so it checks this after every await.
  let generation = 0;

  function startSession() {
    generation++;
    refreshing = null;
  }

  return create<SessionState>()((set, get) => {
    async function signOut() {
      startSession();
      set({ status: "signedOut", idToken: null });
      await clearTokens();
    }

    async function refreshOnce(): Promise<boolean> {
      const started = generation;
      const stale = () => generation !== started;
      try {
        const tokens = await loadTokens();
        if (!tokens) throw new Error("No stored session");
        const idToken = await auth.refreshSession(tokens.refreshToken);
        if (stale()) return false;
        await saveIdToken(idToken);
        if (stale()) {
          // The session changed while the token was being written: put back the current one.
          const current = get().idToken;
          await (current ? saveIdToken(current) : clearTokens());
          return false;
        }
        set({ idToken });
        return true;
      } catch {
        if (!stale()) await signOut().catch(() => undefined);
        return false;
      } finally {
        if (!stale()) refreshing = null;
      }
    }

    return {
      status: "restoring",
      idToken: null,

      async restore() {
        const tokens = await loadTokens().catch(() => null);
        // A sign-in that finished first wins over the stored state.
        if (get().status !== "restoring") return;
        set(
          tokens
            ? { status: "signedIn", idToken: tokens.idToken }
            : { status: "signedOut", idToken: null },
        );
      },

      async signIn(email, password) {
        startSession();
        const tokens = await auth.signIn(email, password);
        await saveTokens(tokens);
        set({ status: "signedIn", idToken: tokens.idToken });
      },

      signOut,

      refresh() {
        refreshing ??= refreshOnce();
        return refreshing;
      },
    };
  });
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** The app's session. Cognito settings are read on the first request, not at import. */
export const useSession = createSessionStore(createCognitoAuth());

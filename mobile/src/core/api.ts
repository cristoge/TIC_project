// The app-wide REST client: requests carry the session's ID token and a 401 refreshes it once.

import { useSession, type SessionStore } from "@/features/auth";
import { createApiClient, type ApiClient } from "@/shared/api";
import { getEnv } from "@/shared/config/env";

type Options = {
  baseUrl: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

export function createSessionApiClient(session: SessionStore, { baseUrl, fetch }: Options) {
  return createApiClient({
    baseUrl,
    getIdToken: async () => session.getState().idToken,
    onUnauthorized: () => session.getState().refresh(),
    fetch,
  });
}

let api: ApiClient | undefined;

/** Built on first use so importing this module does not read the environment. */
export function getApi(): ApiClient {
  api ??= createSessionApiClient(useSession, { baseUrl: getEnv().apiUrl });
  return api;
}

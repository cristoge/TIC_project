import * as SecureStore from "expo-secure-store";

import type { Tokens } from "./cognito";

// One key per token: a single JSON blob could exceed SecureStore's per-value size limit.
const keys = { idToken: "auth.idToken", refreshToken: "auth.refreshToken" } as const;

export async function saveTokens({ idToken, refreshToken }: Tokens): Promise<void> {
  await SecureStore.setItemAsync(keys.idToken, idToken);
  await SecureStore.setItemAsync(keys.refreshToken, refreshToken);
}

export async function saveIdToken(idToken: string): Promise<void> {
  await SecureStore.setItemAsync(keys.idToken, idToken);
}

/** Both tokens, or null when either is missing. */
export async function loadTokens(): Promise<Tokens | null> {
  const [idToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(keys.idToken),
    SecureStore.getItemAsync(keys.refreshToken),
  ]);
  return idToken && refreshToken ? { idToken, refreshToken } : null;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(keys.idToken),
    SecureStore.deleteItemAsync(keys.refreshToken),
  ]);
}

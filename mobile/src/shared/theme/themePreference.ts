// The colour scheme the user chose in Ajustes. It lives on the device, not on the server, and
// also applies to native UI (alerts, keyboard) through Appearance.

import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
const KEY = "settings.theme";

type Storage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type ThemePreferenceState = {
  preference: ThemePreference;
  /** Loads the saved choice once at startup; without one the app follows the system. */
  restore: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

function applyToNative(preference: ThemePreference) {
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

export function createThemePreferenceStore(storage: Storage) {
  return create<ThemePreferenceState>()((set) => ({
    preference: "system",
    async restore() {
      const saved = await storage.getItemAsync(KEY).catch(() => null);
      const preference = PREFERENCES.find((candidate) => candidate === saved) ?? "system";
      set({ preference });
      applyToNative(preference);
    },
    async setPreference(preference) {
      set({ preference });
      applyToNative(preference);
      // A choice that cannot be saved still applies until the app closes.
      await storage.setItemAsync(KEY, preference).catch(() => undefined);
    },
  }));
}

export const useThemePreference = createThemePreferenceStore(SecureStore);

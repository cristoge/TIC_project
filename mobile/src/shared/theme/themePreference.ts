// The colour scheme and accent the user chose in Ajustes. They live on the device, not on the server;
// the scheme also applies to native UI (alerts, keyboard) through Appearance.

import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { create } from "zustand";

import { accents, type AccentName } from "./tokens";

export type ThemePreference = "system" | "light" | "dark";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
const KEY = "settings.theme";
const ACCENT_KEY = "settings.accent";

type Storage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type ThemePreferenceState = {
  preference: ThemePreference;
  accent: AccentName;
  /** Loads the saved choices once at startup; without them the app follows the system, in blue. */
  restore: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
  setAccent: (accent: AccentName) => Promise<void>;
};

function applyToNative(preference: ThemePreference) {
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

export function createThemePreferenceStore(storage: Storage) {
  return create<ThemePreferenceState>()((set) => ({
    preference: "system",
    accent: "blue",
    async restore() {
      const [saved, savedAccent] = await Promise.all(
        [KEY, ACCENT_KEY].map((key) => storage.getItemAsync(key).catch(() => null)),
      );
      const preference = PREFERENCES.find((candidate) => candidate === saved) ?? "system";
      const accent = isAccent(savedAccent) ? savedAccent : "blue";
      set({ preference, accent });
      applyToNative(preference);
    },
    async setPreference(preference) {
      set({ preference });
      applyToNative(preference);
      // A choice that cannot be saved still applies until the app closes.
      await storage.setItemAsync(KEY, preference).catch(() => undefined);
    },
    async setAccent(accent) {
      set({ accent });
      await storage.setItemAsync(ACCENT_KEY, accent).catch(() => undefined);
    },
  }));
}

function isAccent(value: string | null): value is AccentName {
  return value !== null && Object.hasOwn(accents, value);
}

export const useThemePreference = createThemePreferenceStore(SecureStore);

import { Appearance } from "react-native";

import { createThemePreferenceStore } from "./themePreference";

function memoryStorage(initial?: string, accent?: string) {
  const items = new Map<string, string>();
  if (initial) items.set("settings.theme", initial);
  if (accent) items.set("settings.accent", accent);
  return {
    items,
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
  };
}

beforeEach(() => {
  jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("theme preference", () => {
  it("follows the system until something is chosen", () => {
    const store = createThemePreferenceStore(memoryStorage());

    expect(store.getState().preference).toBe("system");
  });

  it("saves a choice on the device and applies it to the native interface", async () => {
    const storage = memoryStorage();
    const store = createThemePreferenceStore(storage);

    await store.getState().setPreference("dark");

    expect(store.getState().preference).toBe("dark");
    expect(storage.items.get("settings.theme")).toBe("dark");
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("dark");

    await store.getState().setPreference("system");

    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("unspecified");
  });

  it("restores the saved choice at startup", async () => {
    const store = createThemePreferenceStore(memoryStorage("light"));

    await store.getState().restore();

    expect(store.getState().preference).toBe("light");
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("light");
  });

  it("ignores a saved value it does not know, or storage that fails", async () => {
    const unknown = createThemePreferenceStore(memoryStorage("sepia"));
    const failing = createThemePreferenceStore({
      getItemAsync: async () => {
        throw new Error("Keychain unavailable");
      },
      setItemAsync: async () => {},
    });

    await unknown.getState().restore();
    await failing.getState().restore();

    expect(unknown.getState().preference).toBe("system");
    expect(failing.getState().preference).toBe("system");
  });

  it("keeps the choice for this session when it cannot be saved", async () => {
    const store = createThemePreferenceStore({
      getItemAsync: async () => null,
      setItemAsync: async () => {
        throw new Error("Keychain unavailable");
      },
    });

    await store.getState().setPreference("dark");

    expect(store.getState().preference).toBe("dark");
  });

  it("uses the blue accent until another is chosen, and saves the choice", async () => {
    const storage = memoryStorage();
    const store = createThemePreferenceStore(storage);
    expect(store.getState().accent).toBe("blue");

    await store.getState().setAccent("green");

    expect(store.getState().accent).toBe("green");
    expect(storage.items.get("settings.accent")).toBe("green");
  });

  it("restores the saved accent, ignoring one it does not know", async () => {
    const saved = createThemePreferenceStore(memoryStorage(undefined, "pink"));
    const unknown = createThemePreferenceStore(memoryStorage(undefined, "teal"));

    await saved.getState().restore();
    await unknown.getState().restore();

    expect(saved.getState().accent).toBe("pink");
    expect(unknown.getState().accent).toBe("blue");
  });
});

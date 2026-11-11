import { createLastProjectStore } from "./lastProject";

function memoryStorage(initial?: string) {
  const items = new Map<string, string>(initial ? [["app.lastProjectId", initial]] : []);
  return {
    items,
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

describe("last project", () => {
  it("is unknown until restored", async () => {
    const store = createLastProjectStore(memoryStorage("p1"));

    expect(store.getState()).toMatchObject({ projectId: null, restored: false });
    await store.getState().restore();
    expect(store.getState()).toMatchObject({ projectId: "p1", restored: true });
  });

  it("remembers the project that was opened, on the device", async () => {
    const storage = memoryStorage();
    const store = createLastProjectStore(storage);

    await store.getState().remember("p2");

    expect(store.getState().projectId).toBe("p2");
    expect(storage.items.get("app.lastProjectId")).toBe("p2");
  });

  it("counts as restored with nothing saved, or when storage fails", async () => {
    const empty = createLastProjectStore(memoryStorage());
    const failing = createLastProjectStore({
      getItemAsync: async () => {
        throw new Error("Keychain unavailable");
      },
      setItemAsync: async () => {
        throw new Error("Keychain unavailable");
      },
    });

    await empty.getState().restore();
    await failing.getState().restore();
    await failing.getState().remember("p3");

    expect(empty.getState()).toMatchObject({ projectId: null, restored: true });
    expect(failing.getState()).toMatchObject({ projectId: "p3", restored: true });
  });
});

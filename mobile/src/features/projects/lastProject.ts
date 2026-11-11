// The project opened most recently, so the app can start in it. It lives on the device only.

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const KEY = "app.lastProjectId";

type Storage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type LastProjectState = {
  projectId: string | null;
  /** False until `restore` has read the device; the start screen waits for it. */
  restored: boolean;
  restore: () => Promise<void>;
  remember: (projectId: string) => Promise<void>;
};

export function createLastProjectStore(storage: Storage) {
  return create<LastProjectState>()((set) => ({
    projectId: null,
    restored: false,
    async restore() {
      const projectId = await storage.getItemAsync(KEY).catch(() => null);
      set({ projectId, restored: true });
    },
    async remember(projectId) {
      set({ projectId, restored: true });
      await storage.setItemAsync(KEY, projectId).catch(() => undefined);
    },
  }));
}

export const useLastProject = createLastProjectStore(SecureStore);

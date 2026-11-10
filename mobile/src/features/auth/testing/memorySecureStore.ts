// In-memory stand-in for expo-secure-store in tests:
// jest.mock("expo-secure-store", () => jest.requireActual("<path>/testing/memorySecureStore")).

export const items = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return items.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  items.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  items.delete(key);
}

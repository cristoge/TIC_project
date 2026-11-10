import { items } from "./testing/memorySecureStore";
import { clearTokens, loadTokens, saveIdToken, saveTokens } from "./tokenStorage";

jest.mock("expo-secure-store", () => jest.requireActual("./testing/memorySecureStore"));

beforeEach(() => items.clear());

describe("tokenStorage", () => {
  it("stores each token under its own key", async () => {
    await saveTokens({ idToken: "id-1", refreshToken: "refresh-1" });

    expect(Object.fromEntries(items)).toEqual({
      "auth.idToken": "id-1",
      "auth.refreshToken": "refresh-1",
    });
    await expect(loadTokens()).resolves.toEqual({ idToken: "id-1", refreshToken: "refresh-1" });
  });

  it("replaces only the ID token", async () => {
    await saveTokens({ idToken: "id-1", refreshToken: "refresh-1" });

    await saveIdToken("id-2");

    await expect(loadTokens()).resolves.toEqual({ idToken: "id-2", refreshToken: "refresh-1" });
  });

  it("loads nothing when a token is missing", async () => {
    await expect(loadTokens()).resolves.toBeNull();

    items.set("auth.idToken", "id-1");
    await expect(loadTokens()).resolves.toBeNull();
  });

  it("clears both tokens", async () => {
    await saveTokens({ idToken: "id-1", refreshToken: "refresh-1" });

    await clearTokens();

    expect(items.size).toBe(0);
    await expect(loadTokens()).resolves.toBeNull();
  });
});

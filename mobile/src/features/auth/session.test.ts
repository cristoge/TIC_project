import { AuthError, createCognitoAuth } from "./cognito";
import { createSessionStore } from "./session";
import { fakeFetch, refreshResult, signInResult, type FakeResponse } from "./testing/fakeFetch";
import { items } from "./testing/memorySecureStore";

jest.mock("expo-secure-store", () => jest.requireActual("./testing/memorySecureStore"));

const config = { region: "eu-south-2", clientId: "client-1" };

function setup(...responses: FakeResponse[]) {
  const fetch = fakeFetch(...responses);
  const store = createSessionStore(createCognitoAuth({ getConfig: () => config, fetch }));
  return { fetch, store };
}

function stored() {
  return Object.fromEntries(items);
}

const signedInTokens = { "auth.idToken": "id-1", "auth.refreshToken": "refresh-1" };

beforeEach(() => items.clear());

describe("session store", () => {
  it("starts restoring", () => {
    const { store } = setup();

    expect(store.getState()).toMatchObject({ status: "restoring", idToken: null });
  });

  it("restores a stored session", async () => {
    Object.entries(signedInTokens).forEach(([key, value]) => items.set(key, value));
    const { store } = setup();

    await store.getState().restore();

    expect(store.getState()).toMatchObject({ status: "signedIn", idToken: "id-1" });
  });

  it("restores to signed out when nothing is stored", async () => {
    const { store } = setup();

    await store.getState().restore();

    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
  });

  it("signs in through Cognito and persists both tokens", async () => {
    const { store } = setup(signInResult("id-1", "refresh-1"));

    await store.getState().signIn("ana@example.com", "pass");

    expect(store.getState()).toMatchObject({ status: "signedIn", idToken: "id-1" });
    expect(stored()).toEqual(signedInTokens);
  });

  it("stays signed out and stores nothing when Cognito rejects the sign-in", async () => {
    const { store } = setup({ status: 400, body: { __type: "NotAuthorizedException" } });
    await store.getState().restore();

    await expect(store.getState().signIn("ana@example.com", "bad")).rejects.toBeInstanceOf(
      AuthError,
    );

    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
    expect(stored()).toEqual({});
  });

  it("signs out by clearing the state and the stored tokens", async () => {
    const { store } = setup(signInResult("id-1", "refresh-1"));
    await store.getState().signIn("ana@example.com", "pass");

    await store.getState().signOut();

    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
    expect(stored()).toEqual({});
  });

  it("refreshes the ID token with the stored refresh token and persists it", async () => {
    const { store, fetch } = setup(signInResult("id-1", "refresh-1"), refreshResult("id-2"));
    await store.getState().signIn("ana@example.com", "pass");

    await expect(store.getState().refresh()).resolves.toBe(true);

    expect(JSON.parse(fetch.mock.calls[1][1].body as string).AuthParameters).toEqual({
      REFRESH_TOKEN: "refresh-1",
    });
    expect(store.getState()).toMatchObject({ status: "signedIn", idToken: "id-2" });
    expect(stored()).toEqual({ "auth.idToken": "id-2", "auth.refreshToken": "refresh-1" });
  });

  it("signs out when the refresh fails", async () => {
    const { store } = setup(signInResult("id-1", "refresh-1"), {
      status: 400,
      body: { __type: "NotAuthorizedException", message: "Refresh Token has expired" },
    });
    await store.getState().signIn("ana@example.com", "pass");

    await expect(store.getState().refresh()).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
    expect(stored()).toEqual({});
  });

  it("signs out when there is no refresh token to use", async () => {
    const { store, fetch } = setup();
    await store.getState().restore();

    await expect(store.getState().refresh()).resolves.toBe(false);

    expect(fetch).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
  });

  it("shares one Cognito request between concurrent refreshes", async () => {
    const { store, fetch } = setup(signInResult("id-1", "refresh-1"), refreshResult("id-2"));
    await store.getState().signIn("ana@example.com", "pass");

    const results = await Promise.all([
      store.getState().refresh(),
      store.getState().refresh(),
      store.getState().refresh(),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(store.getState().idToken).toBe("id-2");
  });

  it("starts a new request for a refresh after the previous one settled", async () => {
    const { store, fetch } = setup(
      signInResult("id-1", "refresh-1"),
      refreshResult("id-2"),
      refreshResult("id-3"),
    );
    await store.getState().signIn("ana@example.com", "pass");

    await store.getState().refresh();
    await store.getState().refresh();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(store.getState().idToken).toBe("id-3");
  });
});

// Regression tests from the independent verification of T3 (odd/tasks/mobile-app.md, L4).
import { createSessionApiClient } from "@/core/api";
import { ApiError } from "@/shared/api";

import { AuthError, createCognitoAuth } from "./cognito";
import { createSessionStore } from "./session";
import { fakeFetch, refreshResult, signInResult } from "./testing/fakeFetch";
import { items } from "./testing/memorySecureStore";

jest.mock("expo-secure-store", () => jest.requireActual("./testing/memorySecureStore"));

const config = { region: "eu-south-2", clientId: "client-1" };

beforeEach(() => items.clear());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function signedIn(cognitoFetch: jest.Mock) {
  const store = createSessionStore(
    createCognitoAuth({ getConfig: () => config, fetch: cognitoFetch }),
  );
  await store.getState().restore();
  await store.getState().signIn("ana@example.com", "pass");
  return store;
}

// Sign-ins succeed as user1, user2, ...; refreshes wait on `gate`.
function twoUsersCognito(gate: { promise: Promise<Response> }) {
  let users = 0;
  return jest.fn(async (_url: string, init: RequestInit) => {
    if (JSON.parse(init.body as string).AuthFlow === "REFRESH_TOKEN_AUTH") return gate.promise;
    users++;
    return response(200, {
      AuthenticationResult: { IdToken: `id-user${users}`, RefreshToken: `r-user${users}` },
    });
  });
}

describe("late refresh results", () => {
  it("a refresh from the previous session does not overwrite the next one", async () => {
    const gate = deferred<Response>();
    const store = await signedIn(twoUsersCognito(gate));

    const refresh = store.getState().refresh();
    await flush();
    await store.getState().signOut();
    await store.getState().signIn("bob@example.com", "pw2");
    gate.resolve(response(200, { AuthenticationResult: { IdToken: "id-user1-refreshed" } }));

    await expect(refresh).resolves.toBe(false);
    expect(store.getState()).toMatchObject({ status: "signedIn", idToken: "id-user2" });
    expect(Object.fromEntries(items)).toEqual({
      "auth.idToken": "id-user2",
      "auth.refreshToken": "r-user2",
    });
  });

  it("a failed refresh from the previous session does not sign the next one out", async () => {
    const gate = deferred<Response>();
    const store = await signedIn(twoUsersCognito(gate));

    const refresh = store.getState().refresh();
    await flush();
    await store.getState().signOut();
    await store.getState().signIn("bob@example.com", "pw2");
    gate.resolve(response(400, { __type: "NotAuthorizedException" }));
    await refresh;

    expect(store.getState()).toMatchObject({ status: "signedIn", idToken: "id-user2" });
    expect(items.size).toBe(2);
  });

  it("a 401 in the next session does not join the previous session's refresh", async () => {
    const gate = deferred<Response>();
    const store = await signedIn(twoUsersCognito(gate));

    const previous = store.getState().refresh();
    await flush();
    await store.getState().signOut();
    await store.getState().signIn("bob@example.com", "pw2");

    expect(store.getState().refresh()).not.toBe(previous);
  });

  it("sign-out during the refreshed token's write leaves no token in memory or storage", async () => {
    const SecureStore = jest.requireMock(
      "expo-secure-store",
    ) as typeof import("./testing/memorySecureStore");
    const store = await signedIn(fakeFetch(signInResult("id-1", "r-1"), refreshResult("id-2")));
    const write = deferred<void>();
    jest.spyOn(SecureStore, "setItemAsync").mockImplementationOnce(async (key, value) => {
      await write.promise;
      SecureStore.items.set(key, value);
    });

    const refresh = store.getState().refresh();
    for (let i = 0; i < 5; i++) await flush();
    await store.getState().signOut();
    write.resolve();
    await refresh;

    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
    expect(items.size).toBe(0);
  });
});

describe("session API client", () => {
  const baseUrl = "https://api.example.com";

  it("a 401 whose refresh fails signs out, empties storage and rejects with 401 after one fetch", async () => {
    const store = await signedIn(
      fakeFetch(signInResult("id-1", "r-1"), {
        status: 400,
        body: { __type: "NotAuthorizedException" },
      }),
    );
    const apiFetch = fakeFetch({ status: 401 });

    const error = await createSessionApiClient(store, { baseUrl, fetch: apiFetch })
      .get("/projects")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ status: "signedOut", idToken: null });
    expect(items.size).toBe(0);
  });

  it("two parallel 401s share one refresh, retry with the new token and keep the refresh token", async () => {
    const cognito = fakeFetch(signInResult("id-1", "r-1"), refreshResult("id-2"));
    const store = await signedIn(cognito);
    const apiFetch = fakeFetch(
      { status: 401 },
      { status: 401 },
      { status: 200, body: {} },
      { status: 200, body: {} },
    );
    const api = createSessionApiClient(store, { baseUrl, fetch: apiFetch });

    await Promise.all([api.get("/a"), api.get("/b")]);

    expect(cognito).toHaveBeenCalledTimes(2);
    const retried = apiFetch.mock.calls[2][1].headers as Record<string, string>;
    expect(retried.Authorization).toBe("Bearer id-2");
    expect(Object.fromEntries(items)).toEqual({
      "auth.idToken": "id-2",
      "auth.refreshToken": "r-1",
    });
  });

  it("a 401 after a successful refresh is not retried again", async () => {
    const cognito = fakeFetch(signInResult("id-1", "r-1"), refreshResult("id-2"));
    const store = await signedIn(cognito);
    const apiFetch = fakeFetch({ status: 401 }, { status: 401 });

    const error = await createSessionApiClient(store, { baseUrl, fetch: apiFetch })
      .get("/a")
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 401 });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(cognito).toHaveBeenCalledTimes(2);
  });
});

it("sign-in errors never contain the password", async () => {
  const password = "S3cr3t-Pa55";
  const failures = [
    { status: 400, body: { __type: "NotAuthorizedException", message: `Incorrect ${password}` } },
    new TypeError(`Network ${password}`),
    { status: 500, body: { message: password } },
  ];

  for (const failure of failures) {
    const auth = createCognitoAuth({ getConfig: () => config, fetch: fakeFetch(failure) });
    const error = await auth.signIn("ana@example.com", password).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    const { message, stack } = error as AuthError;
    expect(`${message}${stack}${JSON.stringify(error)}`).not.toContain(password);
  }
});

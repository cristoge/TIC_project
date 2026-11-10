// Scripted fetch for tests: each call takes the next response, or rejects when it is an Error.

export type FakeResponse = { status: number; body?: unknown } | Error;

export function fakeFetch(...responses: FakeResponse[]) {
  const queue = [...responses];
  return jest.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected request");
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      text: async () => (next.body === undefined ? "" : JSON.stringify(next.body)),
      json: async () => next.body,
    } as Response;
  });
}

export function signInResult(idToken: string, refreshToken: string) {
  return {
    status: 200,
    body: {
      AuthenticationResult: { IdToken: idToken, AccessToken: "access", RefreshToken: refreshToken },
    },
  };
}

export function refreshResult(idToken: string) {
  return {
    status: 200,
    body: { AuthenticationResult: { IdToken: idToken, AccessToken: "access" } },
  };
}

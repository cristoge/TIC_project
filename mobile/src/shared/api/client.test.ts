import { ApiError, createApiClient } from "./client";

type FakeResponse = { status: number; body?: unknown };

function fakeFetch(...responses: FakeResponse[]) {
  const queue = [...responses];
  return jest.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected request");
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      text: async () => (next.body === undefined ? "" : JSON.stringify(next.body)),
    } as Response;
  });
}

function headersOf(call: [string, RequestInit]) {
  return call[1].headers as Record<string, string>;
}

describe("createApiClient", () => {
  it("sends the ID token and returns the parsed body", async () => {
    const fetch = fakeFetch({ status: 200, body: [{ id: "p1" }] });
    const api = createApiClient({ baseUrl: "http://api", getIdToken: async () => "id-1", fetch });

    await expect(api.get("/projects")).resolves.toEqual([{ id: "p1" }]);

    expect(fetch.mock.calls[0][0]).toBe("http://api/projects");
    expect(fetch.mock.calls[0][1].method).toBe("GET");
    expect(headersOf(fetch.mock.calls[0])).toMatchObject({ Authorization: "Bearer id-1" });
  });

  it("sends JSON bodies", async () => {
    const fetch = fakeFetch({ status: 201, body: { id: "p1" } });
    const api = createApiClient({ baseUrl: "http://api", getIdToken: async () => "id-1", fetch });

    await api.post("/projects", { name: "TFE" });

    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(fetch.mock.calls[0][1].body).toBe('{"name":"TFE"}');
    expect(headersOf(fetch.mock.calls[0])).toMatchObject({ "Content-Type": "application/json" });
  });

  it("resolves an empty response to undefined", async () => {
    const fetch = fakeFetch({ status: 204 });
    const api = createApiClient({ baseUrl: "http://api", getIdToken: async () => "id-1", fetch });

    await expect(api.delete("/projects/p1")).resolves.toBeUndefined();
  });

  it("omits Authorization when there is no session", async () => {
    const fetch = fakeFetch({ status: 200, body: {} });
    const api = createApiClient({ baseUrl: "http://api", getIdToken: async () => null, fetch });

    await api.get("/me");

    expect(headersOf(fetch.mock.calls[0])).not.toHaveProperty("Authorization");
  });

  it("throws ApiError with the status and the server's detail", async () => {
    const fetch = fakeFetch({
      status: 409,
      body: { detail: "A project holds at most 20 documents." },
    });
    const api = createApiClient({ baseUrl: "http://api", getIdToken: async () => "id-1", fetch });

    const error = await api.post("/projects/p1/documents", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "A project holds at most 20 documents." });
  });

  it("retries once with a fresh token after a 401 it could recover from", async () => {
    const fetch = fakeFetch({ status: 401 }, { status: 200, body: { id: "me" } });
    const tokens = ["expired", "fresh"];
    const onUnauthorized = jest.fn(async () => true);
    const api = createApiClient({
      baseUrl: "http://api",
      getIdToken: async () => tokens.shift() ?? null,
      onUnauthorized,
      fetch,
    });

    await expect(api.get("/me")).resolves.toEqual({ id: "me" });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(headersOf(fetch.mock.calls[1])).toMatchObject({ Authorization: "Bearer fresh" });
  });

  it("gives up on a 401 it could not recover from", async () => {
    const fetch = fakeFetch({ status: 401 });
    const api = createApiClient({
      baseUrl: "http://api",
      getIdToken: async () => "expired",
      onUnauthorized: async () => false,
      fetch,
    });

    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a 401 only once", async () => {
    const fetch = fakeFetch({ status: 401 }, { status: 401 });
    const onUnauthorized = jest.fn(async () => true);
    const api = createApiClient({
      baseUrl: "http://api",
      getIdToken: async () => "token",
      onUnauthorized,
      fetch,
    });

    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

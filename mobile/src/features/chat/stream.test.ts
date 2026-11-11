import { ApiError } from "@/shared/api";

import { createChatStream, type ChatEvent } from "./stream";
import { fakeAgentFetch } from "./testing/sse";

const URL = "http://agent/invocations";
const TURN = { conversationId: "c1", message: "¿Qué es un grafo?" };
const UNAUTHENTICATED = { type: "error", code: "unauthenticated", message: "Not authenticated." };

async function collect(events: AsyncIterable<ChatEvent>) {
  const collected: ChatEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function headersOf(call: [string, RequestInit]) {
  return call[1].headers as Record<string, string>;
}

describe("createChatStream", () => {
  it("posts the turn with the ID token and yields the agent's events", async () => {
    const events = [
      { type: "token", data: "Un grafo " },
      { type: "sources", data: [{ n: 1, document_id: "d1", document_name: "a.pdf", page: 3 }] },
      { type: "artifact", kind: "summary", id: "s1" },
      { type: "end", message_id: "m1" },
    ];
    const fetch = fakeAgentFetch({ events });
    const stream = createChatStream({ url: URL, getIdToken: async () => "id-1", fetch });

    await expect(collect(stream(TURN))).resolves.toEqual(events);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      conversation_id: "c1",
      message: "¿Qué es un grafo?",
    });
    expect(headersOf(fetch.mock.calls[0])).toMatchObject({
      Authorization: "Bearer id-1",
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    });
  });

  it("passes the abort signal to the request", async () => {
    const fetch = fakeAgentFetch({ events: [] });
    const stream = createChatStream({ url: URL, getIdToken: async () => "id-1", fetch });
    const { signal } = new AbortController();

    await collect(stream({ ...TURN, signal }));

    expect(fetch.mock.calls[0][1].signal).toBe(signal);
  });

  it("refreshes the token once and repeats the turn when the agent rejects it", async () => {
    let token = "expired";
    const fetch = fakeAgentFetch(
      { events: [UNAUTHENTICATED] },
      { events: [{ type: "end", message_id: "m1" }] },
    );
    const onUnauthorized = jest.fn(async () => {
      token = "fresh";
      return true;
    });
    const stream = createChatStream({
      url: URL,
      getIdToken: async () => token,
      onUnauthorized,
      fetch,
    });

    await expect(collect(stream(TURN))).resolves.toEqual([{ type: "end", message_id: "m1" }]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(headersOf(fetch.mock.calls[1])).toMatchObject({ Authorization: "Bearer fresh" });
  });

  it("refreshes the token once and repeats the turn after a 401", async () => {
    const fetch = fakeAgentFetch({ status: 401 }, { events: [{ type: "end", message_id: "m1" }] });
    const onUnauthorized = jest.fn(async () => true);
    const stream = createChatStream({
      url: URL,
      getIdToken: async () => "id-1",
      onUnauthorized,
      fetch,
    });

    await expect(collect(stream(TURN))).resolves.toEqual([{ type: "end", message_id: "m1" }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not repeat the turn a second time", async () => {
    const fetch = fakeAgentFetch({ events: [UNAUTHENTICATED] }, { events: [UNAUTHENTICATED] });
    const onUnauthorized = jest.fn(async () => true);
    const stream = createChatStream({
      url: URL,
      getIdToken: async () => "id-1",
      onUnauthorized,
      fetch,
    });

    await expect(collect(stream(TURN))).resolves.toEqual([UNAUTHENTICATED]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("yields the rejection when the token cannot be refreshed", async () => {
    const fetch = fakeAgentFetch({ events: [UNAUTHENTICATED] });
    const stream = createChatStream({
      url: URL,
      getIdToken: async () => "id-1",
      onUnauthorized: async () => false,
      fetch,
    });

    await expect(collect(stream(TURN))).resolves.toEqual([UNAUTHENTICATED]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws on any other failed status", async () => {
    const fetch = fakeAgentFetch({ status: 500 });
    const stream = createChatStream({ url: URL, getIdToken: async () => "id-1", fetch });

    await expect(collect(stream(TURN))).rejects.toEqual(new ApiError(500, "Request failed (500)."));
  });
});

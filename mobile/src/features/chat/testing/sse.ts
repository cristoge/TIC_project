// Scripted agent for tests: each call answers with the next server-sent event stream or status.

export type FakeStream = { status?: number; events?: unknown[] } | Error;

export function sseBody(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

export function fakeAgentFetch(...responses: FakeStream[]) {
  const queue = [...responses];
  return jest.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected request");
    if (next instanceof Error) throw next;
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      body: sseBody(next.events ?? []),
    } as Response;
  });
}

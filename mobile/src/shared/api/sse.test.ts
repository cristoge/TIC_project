import { readSseJson } from "./sse";

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events: unknown[] = [];
  for await (const event of readSseJson(stream)) events.push(event);
  return events;
}

describe("readSseJson", () => {
  it("yields the JSON payload of each event", async () => {
    const stream = streamOf('data: {"type":"token","data":"Hola"}\n\ndata: {"type":"end"}\n\n');

    await expect(collect(stream)).resolves.toEqual([
      { type: "token", data: "Hola" },
      { type: "end" },
    ]);
  });

  it("joins an event split across chunks, even inside a multi-byte character", async () => {
    const bytes = new TextEncoder().encode('data: {"type":"token","data":"año"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1; // between the two bytes of "ñ"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });

    await expect(collect(stream)).resolves.toEqual([{ type: "token", data: "año" }]);
  });

  it("accepts CRLF line endings and a last event without a blank line", async () => {
    const stream = streamOf('data: {"n":1}\r\n\r\n', 'data: {"n":2}');

    await expect(collect(stream)).resolves.toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("skips comments and events without data", async () => {
    const stream = streamOf(': ping\n\nevent: noop\n\ndata: {"n":1}\n\n');

    await expect(collect(stream)).resolves.toEqual([{ n: 1 }]);
  });
});

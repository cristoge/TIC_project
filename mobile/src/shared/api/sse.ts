// Server-sent events whose data is JSON, as the chat agent sends them (docs/app/README.md § Chat).

const EVENT_BREAK = /\r?\n\r?\n/;

/** Yields the parsed `data` of each event in the stream; comments and events without data are skipped. */
export async function* readSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const blocks = buffer.split(EVENT_BREAK);
      // Without a closing blank line the last block may be incomplete, unless the stream has ended.
      buffer = done ? "" : (blocks.pop() ?? "");
      for (const block of blocks) {
        const data = dataOf(block);
        if (data) yield JSON.parse(data);
      }
      if (done) return;
    }
  } finally {
    // Closes the connection when the consumer stops reading early.
    await reader.cancel().catch(() => undefined);
  }
}

function dataOf(block: string): string {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
}

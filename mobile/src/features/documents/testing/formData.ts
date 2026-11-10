// Jest runs with Node's FormData, which turns React Native's `{ uri, name, type }` file into a
// string. Tests swap in a recorder that keeps every appended entry, in order.
class RecordingFormData {
  readonly entries: [string, unknown][] = [];

  append(name: string, value: unknown) {
    this.entries.push([name, value]);
  }
}

/** Call at the top of a test file whose code under test builds a FormData. */
export function recordFormData() {
  const original = globalThis.FormData;
  beforeEach(() => {
    globalThis.FormData = RecordingFormData as unknown as typeof FormData;
  });
  afterEach(() => {
    globalThis.FormData = original;
  });
}

/** The entries appended to a request body built while `recordFormData` was active. */
export function formFields(body: unknown): [string, unknown][] {
  if (!(body instanceof RecordingFormData)) throw new Error("Expected a FormData body.");
  return body.entries;
}

import type { Conversation, Message } from "../api";
import type { ChatEvent } from "../stream";

export function aConversation(
  overrides: Partial<Conversation> & Pick<Conversation, "id">,
): Conversation {
  return {
    project_id: "p1",
    title: null,
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    ...overrides,
  };
}

export function aMessage(overrides: Partial<Message> & Pick<Message, "id" | "content">): Message {
  return {
    role: "assistant",
    created_at: "2026-11-01T12:00:00Z",
    summary_id: null,
    flashcard_deck_id: null,
    quiz_id: null,
    sources: [],
    ...overrides,
  };
}

/** A chat stream that yields `events`; an Error among them is thrown at that point. */
export function streamOf(...events: (ChatEvent | Error)[]) {
  return async function* scripted(): AsyncGenerator<ChatEvent> {
    for (const event of events) {
      if (event instanceof Error) throw event;
      yield event;
    }
  };
}

/** A chat stream that waits for `release()` before each event after the first `held` ones. */
export function heldStream(events: ChatEvent[], held: number) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* scripted(): AsyncGenerator<ChatEvent> {
    for (const [index, event] of events.entries()) {
      if (index >= held) await gate;
      yield event;
    }
  }
  return { stream: scripted, release };
}

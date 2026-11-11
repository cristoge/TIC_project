// One chat turn against the agent: POST the message, read its answer as server-sent events
// (docs/app/README.md § Chat). Like the REST client, a rejected token is refreshed once and the turn
// repeated. The local agent reports it as an `unauthenticated` event on a 200; AgentCore answers 401.

import { ApiError, readSseJson, type Schemas } from "@/shared/api";

export type Source = Schemas["SourceOut"];
export type ArtifactKind = "summary" | "flashcards" | "quiz";

export type ChatEvent =
  | { type: "token"; data: string }
  | { type: "sources"; data: Source[] }
  | { type: "artifact"; kind: ArtifactKind; id: string }
  | { type: "end"; message_id: string }
  | { type: "error"; code: string; message: string };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type Options = {
  url: string;
  getIdToken: () => Promise<string | null>;
  /** Called when the agent rejects the token. Resolves true when a fresh one is available. */
  onUnauthorized?: () => Promise<boolean>;
  fetch?: Fetch;
};

export type ChatTurn = { conversationId: string; message: string; signal?: AbortSignal };

export type ChatStream = (turn: ChatTurn) => AsyncGenerator<ChatEvent>;

export function createChatStream({
  url,
  getIdToken,
  onUnauthorized,
  fetch = globalThis.fetch,
}: Options): ChatStream {
  async function send({ conversationId, message, signal }: ChatTurn) {
    const token = await getIdToken();
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ conversation_id: conversationId, message }),
      signal,
    });
  }

  return async function* chatStream(turn) {
    for (let attempt = 0; ; attempt++) {
      const refresh = attempt === 0 ? onUnauthorized : undefined;
      const response = await send(turn);
      if (response.status === 401 && refresh && (await refresh())) continue;
      if (!response.ok || !response.body) {
        throw new ApiError(response.status, `Request failed (${response.status}).`);
      }

      let first = true;
      let repeat = false;
      for await (const event of readSseJson(response.body) as AsyncGenerator<ChatEvent>) {
        // The rejection is the only event of its stream, so nothing has been yielded yet.
        if (first && isUnauthenticated(event) && refresh && (await refresh())) {
          repeat = true;
          break;
        }
        first = false;
        yield event;
      }
      if (!repeat) return;
    }
  };
}

function isUnauthenticated(event: ChatEvent): boolean {
  return event.type === "error" && event.code === "unauthenticated";
}

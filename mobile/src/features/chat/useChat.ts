import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getChatStream } from "@/core/agent";

import { createConversation, useMessages, type Message } from "./api";
import { chatKeys } from "./queryKeys";
import type { ArtifactKind, Source } from "./stream";

export type Artifact = { kind: ArtifactKind; id: string };

/** The question being answered. It lives here until the agent ends it; only then is it saved. */
export type Turn = {
  question: string;
  answer: string;
  sources: Source[];
  artifacts: Artifact[];
  error: string | null;
};

const TITLE_LENGTH = 60;

const ERRORS: Record<string, string> = {
  no_answer: "No he podido responder. Inténtalo de nuevo.",
  not_found: "Este chat ya no existe.",
  invalid_request: "El mensaje no es válido.",
  unauthenticated: "La sesión ha caducado. Vuelve a iniciar sesión.",
};
const UNKNOWN_ERROR = "Algo ha fallado. Inténtalo de nuevo.";
const INTERRUPTED = "La respuesta se interrumpió.";
const UNREACHABLE = "No se pudo conectar con el asistente.";

type Options = {
  projectId: string;
  /** Null for a chat that has not been created yet: the first message creates it. */
  conversationId: string | null;
  onCreated?: (conversationId: string) => void;
};

export function useChat({ projectId, conversationId: initialId, onCreated }: Options) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState(initialId);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [sending, setSending] = useState(false);
  const messages = useMessages(conversationId);
  // Guards a second send that arrives before `sending` re-renders the composer.
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function create(question: string) {
    const conversation = await createConversation(projectId, titleFrom(question));
    // A new conversation has no messages; seeding the cache saves asking for them.
    queryClient.setQueryData<Message[]>(chatKeys.messages(conversation.id), []);
    void queryClient.invalidateQueries({ queryKey: chatKeys.list(projectId) });
    setConversationId(conversation.id);
    onCreated?.(conversation.id);
    return conversation.id;
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;

    let current: Turn = { question, answer: "", sources: [], artifacts: [], error: null };
    const update = (changes: Partial<Turn>) => {
      current = { ...current, ...changes };
      setTurn(current);
    };
    update({});
    setSending(true);

    try {
      const id = conversationId ?? (await create(question));
      const turnOf = { conversationId: id, message: question, signal: controller.signal };
      for await (const event of getChatStream()(turnOf)) {
        if (event.type === "token") update({ answer: current.answer + event.data });
        else if (event.type === "sources") update({ sources: event.data });
        else if (event.type === "artifact") {
          update({ artifacts: [...current.artifacts, { kind: event.kind, id: event.id }] });
        } else if (event.type === "error") {
          return update({ error: ERRORS[event.code] ?? UNKNOWN_ERROR });
        } else {
          queryClient.setQueryData<Message[]>(chatKeys.messages(id), (saved = []) => [
            ...saved,
            ...toMessages(current, event.message_id),
          ]);
          setTurn(null);
          // The server's copy replaces the local one (real ids and dates).
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
          return;
        }
      }
      update({ error: INTERRUPTED });
    } catch {
      // Closing the screen aborts the request; there is nobody left to tell.
      if (!controller.signal.aborted) update({ error: UNREACHABLE });
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return { messages, turn, sending, send, isNew: conversationId === null };
}

function titleFrom(question: string): string {
  return question.length > TITLE_LENGTH ? `${question.slice(0, TITLE_LENGTH - 1)}…` : question;
}

function toMessages(turn: Turn, messageId: string): Message[] {
  const created_at = new Date().toISOString();
  const idOf = (kind: ArtifactKind) =>
    turn.artifacts.find((artifact) => artifact.kind === kind)?.id ?? null;
  const none = { summary_id: null, flashcard_deck_id: null, quiz_id: null, sources: [] };
  return [
    { ...none, id: `local-${messageId}`, role: "user", content: turn.question, created_at },
    {
      id: messageId,
      role: "assistant",
      content: turn.answer,
      created_at,
      sources: turn.sources,
      summary_id: idOf("summary"),
      flashcard_deck_id: idOf("flashcards"),
      quiz_id: idOf("quiz"),
    },
  ];
}

import type { Conversation } from "./api";

export const UNTITLED = "Chat sin título";

export function conversationTitle(conversation: Pick<Conversation, "title">): string {
  return conversation.title?.trim() || UNTITLED;
}

/** The day of the last activity, such as "5 nov". */
export function conversationDate(conversation: Pick<Conversation, "updated_at">): string {
  return new Date(conversation.updated_at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApi } from "@/core/api";
import type { Schemas } from "@/shared/api";

import { chatKeys } from "./queryKeys";

export type Conversation = Schemas["ConversationOut"];
export type Message = Schemas["MessageOut"];

export function useConversations(projectId: string) {
  return useQuery({
    queryKey: chatKeys.list(projectId),
    queryFn: () => getApi().get<Conversation[]>(`/projects/${projectId}/conversations`),
  });
}

export function createConversation(projectId: string, title: string) {
  return getApi().post<Conversation>(`/projects/${projectId}/conversations`, { title });
}

export const TITLE_MAX_LENGTH = 200;

export function useRenameConversation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      getApi().patch<Conversation>(`/conversations/${id}`, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.list(projectId) }),
  });
}

export function useDeleteConversation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getApi().delete(`/conversations/${id}`),
    // Returning the promise keeps the mutation pending until the list has been refetched.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.list(projectId) }),
  });
}

/** The messages of a conversation; idle while the conversation does not exist yet. */
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? "new"),
    queryFn: () => getApi().get<Message[]>(`/conversations/${conversationId}/messages`),
    enabled: conversationId !== null,
  });
}

/** Query keys of the chat feature. Conversations nest under their project's key. */
export const chatKeys = {
  list: (projectId: string) => ["projects", projectId, "conversations"] as const,
  messages: (conversationId: string) => ["conversations", conversationId, "messages"] as const,
};

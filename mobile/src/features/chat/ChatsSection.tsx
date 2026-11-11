import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { Button, EmptyState, ErrorState } from "@/shared/ui";

import { useConversations, useDeleteConversation, type Conversation } from "./api";
import { ConversationRow } from "./components/ConversationRow";

type Props = { projectId: string };

export function ChatsSection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const conversations = useConversations(projectId);
  const deleteConversation = useDeleteConversation(projectId);

  function confirmDelete(conversation: Conversation) {
    Alert.alert(
      "¿Eliminar chat?",
      "Se borrarán sus mensajes.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () =>
            deleteConversation.mutate(conversation.id, {
              onError: (failure) => Alert.alert("No se pudo eliminar el chat", failure.message),
            }),
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <View style={styles.section}>
      {/* The conversation is created by its first message, so an unused chat leaves nothing behind. */}
      <Button
        label="Nuevo chat"
        icon="newChat"
        onPress={() => router.push(`/projects/${projectId}/chats/new`)}
      />
      {conversations.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : conversations.isError ? (
        <ErrorState message={conversations.error.message} onRetry={() => conversations.refetch()} />
      ) : (
        <FlatList
          data={conversations.data}
          keyExtractor={(conversation) => conversation.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onOpen={(conversation) =>
                router.push(`/projects/${projectId}/chats/${conversation.id}`)
              }
              onDelete={confirmDelete}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chats"
              title="Aún no hay chats"
              message="Empieza uno para preguntar sobre los documentos del proyecto."
            />
          }
          style={styles.list}
          contentContainerStyle={styles.content}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: { flex: 1, gap: theme.spacing.lg },
  list: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
});

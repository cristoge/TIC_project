import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import {
  EmptyState,
  ErrorState,
  FLOATING_BUTTON_SPACE,
  FloatingButton,
  NameForm,
  Sheet,
} from "@/shared/ui";

import {
  TITLE_MAX_LENGTH,
  useConversations,
  useDeleteConversation,
  useRenameConversation,
  type Conversation,
} from "./api";
import { ConversationRow } from "./components/ConversationRow";
import { conversationTitle } from "./conversationDetails";

const BLANK_NAME = "Escribe un nombre.";

// The rename form where there is no native prompt (Android).
type Renaming = { conversation: Conversation; name: string };

type Props = { projectId: string };

export function ChatsSection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const conversations = useConversations(projectId);
  const renameConversation = useRenameConversation(projectId);
  const deleteConversation = useDeleteConversation(projectId);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  // Guards a second press that arrives before the loading state re-renders the button.
  const saving = useRef(false);

  // A menu in the middle of the screen, like the delete confirmation.
  function openOptions(conversation: Conversation) {
    Alert.alert(
      conversationTitle(conversation),
      undefined,
      [
        { text: "Renombrar", onPress: () => openRename(conversation) },
        { text: "Eliminar", style: "destructive", onPress: () => confirmDelete(conversation) },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true },
    );
  }

  function openRename(conversation: Conversation) {
    const name = conversation.title?.trim() ?? "";
    // Alert.prompt only exists on iOS; elsewhere the name is edited in the sheet.
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Renombrar chat",
        undefined,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar", onPress: (text?: string) => renameFromPrompt(conversation, text) },
        ],
        "plain-text",
        name,
      );
      return;
    }
    setErrors({});
    setRenaming({ conversation, name });
  }

  function renameFromPrompt(conversation: Conversation, text = "") {
    const title = text.trim();
    if (!title) return Alert.alert(BLANK_NAME);
    renameConversation.mutate(
      { id: conversation.id, title },
      { onError: (failure) => Alert.alert("No se pudo renombrar el chat", failure.message) },
    );
  }

  async function submitRename() {
    if (saving.current || !renaming) return;
    const title = renaming.name.trim();
    setErrors({ name: title ? undefined : BLANK_NAME });
    if (!title) return;
    saving.current = true;
    try {
      await renameConversation.mutateAsync({ id: renaming.conversation.id, title });
      setRenaming(null);
    } catch (failure) {
      setErrors({ form: failure instanceof Error ? failure.message : String(failure) });
    } finally {
      saving.current = false;
    }
  }

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
              onOptions={openOptions}
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
      <Sheet visible={renaming !== null} title="Renombrar chat" onClose={() => setRenaming(null)}>
        {renaming ? (
          <NameForm
            name={renaming.name}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(name) => setRenaming({ ...renaming, name })}
            onSubmit={submitRename}
            onCancel={() => setRenaming(null)}
            nameError={errors.name}
            error={errors.form}
            loading={renameConversation.isPending}
          />
        ) : null}
      </Sheet>
      {/* The conversation is created by its first message, so an unused chat leaves nothing behind. */}
      <FloatingButton
        icon="newChat"
        label="Nuevo chat"
        onPress={() => router.push(`/projects/${projectId}/chats/new`)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: { flex: 1, gap: theme.spacing.lg },
  list: { flex: 1 },
  content: { paddingBottom: FLOATING_BUTTON_SPACE },
});

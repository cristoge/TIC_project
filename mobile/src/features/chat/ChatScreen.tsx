import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, EmptyState, ErrorState, Screen, Sheet } from "@/shared/ui";

import type { Message } from "./api";
import { Composer } from "./components/Composer";
import { MessageBubble } from "./components/MessageBubble";
import type { Source } from "./stream";
import { useChat, type Artifact, type Turn } from "./useChat";

type Props = {
  projectId: string;
  /** Null for a new chat: the first message creates the conversation. */
  conversationId: string | null;
  onCreated?: (conversationId: string) => void;
  onOpenArtifact?: (artifact: Artifact) => void;
  /** Height of whatever sits above the screen (the header), so the keyboard does not cover the composer. */
  keyboardOffset?: number;
};

type Item = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  artifacts: Artifact[];
};

export function ChatScreen({
  projectId,
  conversationId,
  onCreated,
  onOpenArtifact,
  keyboardOffset = 0,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { messages, turn, sending, send, isNew } = useChat({
    projectId,
    conversationId,
    onCreated,
  });
  const [citation, setCitation] = useState<Source | null>(null);
  const list = useRef<FlatList<Item>>(null);

  const saved = useMemo(() => (messages.data ?? []).map(toItem), [messages.data]);
  const items = turn ? [...saved, ...turnItems(turn)] : saved;
  const loading = !isNew && messages.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardOffset}
      style={styles.container}
    >
      <Screen>
        {loading ? (
          <ActivityIndicator color={theme.colors.textMuted} style={styles.list} />
        ) : messages.isError ? (
          <View style={styles.list}>
            <ErrorState message={messages.error.message} onRetry={() => messages.refetch()} />
          </View>
        ) : (
          <FlatList
            ref={list}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                role={item.role}
                content={item.content}
                sources={item.sources}
                artifacts={item.artifacts}
                onCitation={setCitation}
                onOpenArtifact={onOpenArtifact}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="chats"
                title="Pregunta sobre tus documentos"
                message="También puedes pedir un resumen, flashcards o un test."
              />
            }
            ListFooterComponent={turn ? <TurnStatus turn={turn} onRetry={send} /> : undefined}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.content}
          />
        )}
        <Composer onSend={send} disabled={sending || loading} />
      </Screen>
      <Sheet
        visible={citation !== null}
        title={citation ? `Cita [${citation.n}]` : ""}
        onClose={() => setCitation(null)}
      >
        {citation ? (
          <View style={styles.citation}>
            <AppText variant="label">{citation.document_name}</AppText>
            <AppText color="textMuted">Página {citation.page}</AppText>
            <Button label="Cerrar" variant="secondary" onPress={() => setCitation(null)} />
          </View>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** What follows the turn in progress: that the agent is working, or why it failed. */
function TurnStatus({ turn, onRetry }: { turn: Turn; onRetry: (question: string) => void }) {
  const styles = useThemedStyles(createStyles);

  if (turn.error) {
    return (
      <View style={styles.status}>
        <AppText color="danger" accessibilityRole="alert">
          {turn.error}
        </AppText>
        <Button label="Reintentar" variant="secondary" onPress={() => onRetry(turn.question)} />
      </View>
    );
  }
  return turn.answer ? null : <AppText color="textMuted">Pensando…</AppText>;
}

function toItem(message: Message): Item {
  const artifacts: Artifact[] = [];
  if (message.summary_id) artifacts.push({ kind: "summary", id: message.summary_id });
  if (message.flashcard_deck_id)
    artifacts.push({ kind: "flashcards", id: message.flashcard_deck_id });
  if (message.quiz_id) artifacts.push({ kind: "quiz", id: message.quiz_id });
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sources: message.sources,
    artifacts,
  };
}

function turnItems(turn: Turn): Item[] {
  const question = { id: "turn-question", role: "user" as const, content: turn.question };
  const answer = { id: "turn-answer", role: "assistant" as const, content: turn.answer };
  return [
    { ...question, sources: [], artifacts: [] },
    { ...answer, sources: turn.sources, artifacts: turn.artifacts },
  ];
}

const createStyles = (theme: Theme) => ({
  container: { flex: 1 },
  list: { flex: 1 },
  content: { gap: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  status: { gap: theme.spacing.sm, paddingTop: theme.spacing.lg },
  citation: { gap: theme.spacing.sm },
});

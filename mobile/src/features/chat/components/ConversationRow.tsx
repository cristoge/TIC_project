import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Card } from "@/shared/ui";

import type { Conversation } from "../api";
import { conversationDate, conversationTitle } from "../conversationDetails";

type Props = {
  conversation: Conversation;
  onOpen: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
};

export function ConversationRow({ conversation, onOpen, onDelete }: Props) {
  const styles = useThemedStyles(createStyles);
  const title = conversationTitle(conversation);

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(conversation)}
        onLongPress={() => onDelete(conversation)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="label" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {conversationDate(conversation)}
        </AppText>
      </Pressable>
      {/* A visible sibling (not nested) so screen readers and users unaware of long-press reach it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${title}`}
        hitSlop={8}
        onPress={() => onDelete(conversation)}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        <AppText variant="heading" color="textMuted" importantForAccessibility="no">
          ×
        </AppText>
      </Pressable>
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  card: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  main: { flex: 1, gap: theme.spacing.xs },
  remove: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.pill,
  },
  pressed: { opacity: 0.6 },
});

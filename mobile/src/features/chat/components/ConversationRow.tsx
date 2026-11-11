import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Card, IconButton } from "@/shared/ui";

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
      <IconButton
        icon="delete"
        label={`Eliminar ${title}`}
        onPress={() => onDelete(conversation)}
      />
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  card: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  main: { flex: 1, gap: theme.spacing.xs },
  pressed: { opacity: 0.6 },
});

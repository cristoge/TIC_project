import { useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { IconButton } from "@/shared/ui";

type Props = {
  onSend: (text: string) => void;
  /** True while a turn is in progress or the conversation is still loading. */
  disabled: boolean;
};

export function Composer({ onSend, disabled }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState("");

  function submit() {
    onSend(text);
    setText("");
  }

  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Mensaje"
        placeholder="Escribe tu pregunta"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        value={text}
        onChangeText={setText}
        style={styles.input}
      />
      <IconButton
        icon="send"
        label="Enviar"
        variant="accent"
        onPress={submit}
        disabled={disabled || !text.trim()}
      />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  // One rounded field with the send button inside it, as in most chat apps.
  composer: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: theme.spacing.sm,
    padding: theme.spacing.xs,
    paddingLeft: theme.spacing.md,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
  },
});

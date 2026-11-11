import { useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { Button } from "@/shared/ui";

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
      <Button label="Enviar" onPress={submit} disabled={disabled || !text.trim()} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  composer: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: theme.spacing.sm,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
});

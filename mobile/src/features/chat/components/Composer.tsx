import { useContext, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { IconButton } from "@/shared/ui";

type Props = {
  onSend: (text: string) => void;
  /** True while a turn is in progress or the conversation is still loading. */
  disabled: boolean;
};

/** Height of one line of the field, which matches the send button. */
const LINE_HEIGHT = 40;

export function Composer({ onSend, disabled }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState("");
  // Read the context rather than useSafeAreaInsets, which throws when no provider is mounted.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  function submit() {
    onSend(text);
    setText("");
  }

  return (
    <View
      style={[
        styles.composer,
        // The screen already pads its bottom; lift the field the rest of the way to the top of the
        // home indicator area so it stays clear of the device's rounded corners.
        { marginBottom: Math.max(0, bottomInset - theme.spacing.lg) },
      ]}
    >
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
  // A floating, pill-shaped field with the round send button inside it, as in most chat apps.
  composer: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: theme.spacing.sm,
    padding: theme.spacing.xs,
    paddingLeft: theme.spacing.lg,
    // Half the one-line height: a pill on one line that stays evenly rounded as the text grows.
    borderRadius: (LINE_HEIGHT + 2 * theme.spacing.xs) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    // A soft lift off the conversation, the same in both schemes.
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    minHeight: LINE_HEIGHT,
    maxHeight: 140,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
  },
});

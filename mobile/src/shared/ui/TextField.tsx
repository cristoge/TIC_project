import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Props = Omit<TextInputProps, "style"> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
};

export function TextField({ label, error, ...inputProps }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: { gap: theme.spacing.xs },
  input: {
    ...theme.typography.body,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.danger },
});

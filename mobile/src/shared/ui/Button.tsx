import { ActivityIndicator, Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: Props) {
  const styles = useThemedStyles(createStyles);
  const inactive = disabled || loading;
  const textColor = variant === "primary" ? "onAccent" : variant === "danger" ? "danger" : "text";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styles[`${variant}Text`].color} />
      ) : (
        <AppText variant="label" color={textColor}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  base: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryText: { color: theme.colors.onAccent },
  secondaryText: { color: theme.colors.text },
  dangerText: { color: theme.colors.danger },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});

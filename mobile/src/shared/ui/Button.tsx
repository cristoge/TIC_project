import { ActivityIndicator, Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Shown before the label. */
  icon?: IconName;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, icon }: Props) {
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
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={17} color={textColor} /> : null}
          <AppText variant="label" color={textColor}>
            {label}
          </AppText>
        </View>
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
  content: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  primaryText: { color: theme.colors.onAccent },
  secondaryText: { color: theme.colors.text },
  dangerText: { color: theme.colors.danger },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});

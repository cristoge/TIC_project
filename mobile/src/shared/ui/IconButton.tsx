import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { Icon, type IconName } from "./Icon";

type Props = {
  icon: IconName;
  /** What a screen reader says, such as "Opciones de Tema 1.pdf". */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** "accent" for the main action of a screen, such as sending a message. */
  variant?: "plain" | "accent";
};

export function IconButton({ icon, label, onPress, disabled, variant = "plain" }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "accent" && styles.accent,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon
        name={icon}
        size={variant === "accent" ? 18 : 20}
        color={variant === "accent" ? "onAccent" : "textMuted"}
      />
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  base: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.md,
  },
  accent: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});

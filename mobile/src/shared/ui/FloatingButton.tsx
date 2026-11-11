import { ActivityIndicator, Pressable } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * The screen's main action as a pill floating over the bottom-right corner, within reach of the
 * thumb. Place it last inside a container with `flex: 1`, and leave `FLOATING_BUTTON_SPACE` at the
 * bottom of the list under it so it never covers the last row.
 */
export function FloatingButton({ icon, label, onPress, disabled, loading }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onAccent} />
      ) : (
        <Icon name={icon} size={18} color="onAccent" />
      )}
      <AppText variant="label" color="onAccent">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Bottom padding a list needs so its last row can scroll clear of the floating button. */
export const FLOATING_BUTTON_SPACE = 88;

const createStyles = (theme: Theme) => ({
  button: {
    position: "absolute" as const,
    right: 0,
    bottom: theme.spacing.sm,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accent,
    // A soft lift off the list, the same in both schemes.
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});

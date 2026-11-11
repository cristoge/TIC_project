import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Props = {
  label: string;
  checked: boolean;
  onPress: () => void;
};

/** One choice of a group, such as a quiz option. Wrap the group in a `radiogroup` view. */
export function RadioOption({ label, checked, onPress }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, checked && styles.checked, pressed && styles.pressed]}
    >
      <AppText>{label}</AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  option: {
    minHeight: 44,
    justifyContent: "center" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  checked: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  pressed: { opacity: 0.85 },
});

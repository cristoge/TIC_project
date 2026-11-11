import { Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A row of tabs that switches between sibling sections of one screen. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="label" color={selected ? "text" : "textMuted"}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  track: {
    flexDirection: "row" as const,
    padding: 2,
    gap: 2,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.sm,
  },
  selected: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.6 },
});

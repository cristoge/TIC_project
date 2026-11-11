import { View, type ViewProps } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

export function Card({ style, ...props }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]} {...props} />;
}

const createStyles = (theme: Theme) => ({
  // A thin border on the background instead of a coloured block.
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
});

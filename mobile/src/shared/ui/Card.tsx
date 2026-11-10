import { View, type ViewProps } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

export function Card({ style, ...props }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]} {...props} />;
}

const createStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
});

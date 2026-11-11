import { StyleSheet, View, type ViewProps } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

/** One row of a list, divided from the next by a hairline rather than boxed in a card. */
export function ListItem({ style, ...props }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.item, style]} {...props} />;
}

const createStyles = (theme: Theme) => ({
  item: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
});

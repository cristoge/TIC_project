import { View, type ViewProps } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

/** Full-screen container with the theme background and the standard side gutter. */
export function Screen({ style, ...props }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.screen, style]} {...props} />;
}

const createStyles = (theme: Theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
});

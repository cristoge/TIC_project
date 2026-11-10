import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Props = {
  title: string;
  message: string;
};

/** What a list shows before it has anything in it. */
export function EmptyState({ title, message }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <AppText variant="heading">{title}</AppText>
      <AppText color="textMuted">{message}</AppText>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: { gap: theme.spacing.xs, paddingVertical: theme.spacing.xl },
});

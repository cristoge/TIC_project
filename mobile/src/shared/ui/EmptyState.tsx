import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  message: string;
  icon?: IconName;
};

/** What a list shows before it has anything in it. */
export function EmptyState({ title, message, icon }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      {icon ? <Icon name={icon} size={28} color="textMuted" /> : null}
      <AppText variant="heading" style={styles.text}>
        {title}
      </AppText>
      <AppText color="textMuted" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    alignItems: "center" as const,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  text: { textAlign: "center" as const },
});

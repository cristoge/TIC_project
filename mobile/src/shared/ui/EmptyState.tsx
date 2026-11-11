import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  message: string;
  icon?: IconName;
  /** The one thing to do next, such as creating the first item. */
  action?: { label: string; onPress: () => void };
};

/** What a list shows before it has anything in it. */
export function EmptyState({ title, message, icon, action }: Props) {
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
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} icon="add" onPress={action.onPress} />
        </View>
      ) : null}
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
  action: { paddingTop: theme.spacing.md },
});

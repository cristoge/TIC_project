import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";
import { Button } from "./Button";

type Props = {
  message: string;
  onRetry: () => void;
};

/** A failed load: its message and a way to try again. */
export function ErrorState({ message, onRetry }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <AppText color="danger" accessibilityRole="alert">
        {message}
      </AppText>
      <Button label="Reintentar" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: { gap: theme.spacing.md },
});

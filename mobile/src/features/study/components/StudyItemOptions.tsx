import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { Button } from "@/shared/ui";

type Props = {
  onRename: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

export function StudyItemOptions({ onRename, onDelete, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.actions}>
      <Button label="Renombrar" variant="secondary" onPress={onRename} />
      <Button label="Eliminar" variant="danger" onPress={onDelete} />
      <Button label="Cancelar" variant="secondary" onPress={onCancel} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  actions: { gap: theme.spacing.sm },
});

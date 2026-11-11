import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, TextField } from "@/shared/ui";

import { TOPIC_MAX_LENGTH } from "../studyForm";

type Props = {
  name: string;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** Save failure shown under the field. */
  error?: string;
  loading?: boolean;
};

export function StudyNameForm({ name, onChange, onSubmit, onCancel, error, loading }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <TextField
        label="Nombre"
        value={name}
        onChangeText={onChange}
        maxLength={TOPIC_MAX_LENGTH}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <AppText variant="caption" color="textMuted">
        Si lo dejas vacío, se numera.
      </AppText>
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label="Guardar" onPress={onSubmit} loading={loading} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  form: { gap: theme.spacing.lg },
  actions: { gap: theme.spacing.sm },
});

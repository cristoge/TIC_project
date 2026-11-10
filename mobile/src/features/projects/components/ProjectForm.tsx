import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, TextField } from "@/shared/ui";

import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, type ProjectFormValues } from "../projectForm";

type Props = {
  values: ProjectFormValues;
  onChange: (values: ProjectFormValues) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  nameError?: string;
  /** Save failure shown under the fields. */
  error?: string;
  loading?: boolean;
};

export function ProjectForm({
  values,
  onChange,
  submitLabel,
  onSubmit,
  onCancel,
  nameError,
  error,
  loading,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <TextField
        label="Nombre"
        value={values.name}
        onChangeText={(name) => onChange({ ...values, name })}
        error={nameError}
        maxLength={NAME_MAX_LENGTH}
        returnKeyType="next"
      />
      <TextField
        label="Descripción (opcional)"
        value={values.description}
        onChangeText={(description) => onChange({ ...values, description })}
        maxLength={DESCRIPTION_MAX_LENGTH}
        multiline
      />
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label={submitLabel} onPress={onSubmit} loading={loading} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  form: { gap: theme.spacing.lg },
  actions: { gap: theme.spacing.sm },
});

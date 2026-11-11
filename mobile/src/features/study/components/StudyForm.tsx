import { View } from "react-native";

import type { Document } from "@/features/documents";
import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, RadioOption, TextField } from "@/shared/ui";

import { TOPIC_MAX_LENGTH, type StudyFormValues } from "../studyForm";

type Props = {
  documents: Document[];
  values: StudyFormValues;
  onChange: (values: StudyFormValues) => void;
  /** Such as "Número de tarjetas". */
  countLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  countError?: string;
  /** Creation failure shown under the fields. */
  error?: string;
  loading?: boolean;
};

export function StudyForm({
  documents,
  values,
  onChange,
  countLabel,
  onSubmit,
  onCancel,
  countError,
  error,
  loading,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Documento" style={styles.choices}>
        <AppText variant="label">Documento</AppText>
        {documents.map((document) => (
          <RadioOption
            key={document.id}
            label={document.name}
            checked={values.documentId === document.id}
            onPress={() => onChange({ ...values, documentId: document.id })}
          />
        ))}
      </View>
      <TextField
        label="Tema (opcional)"
        value={values.topic}
        onChangeText={(topic) => onChange({ ...values, topic })}
        maxLength={TOPIC_MAX_LENGTH}
      />
      <TextField
        label={countLabel}
        value={values.count}
        onChangeText={(count) => onChange({ ...values, count })}
        keyboardType="number-pad"
        maxLength={2}
        error={countError}
      />
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label="Crear" onPress={onSubmit} loading={loading} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  form: { gap: theme.spacing.lg },
  choices: { gap: theme.spacing.sm },
  actions: { gap: theme.spacing.sm },
});

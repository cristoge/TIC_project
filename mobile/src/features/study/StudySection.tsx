import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, EmptyState, ErrorState, SegmentedControl, Sheet } from "@/shared/ui";

import { useCreateStudyItem, useProjectStudy, type StudyItem, type StudyKind } from "./api";
import { StudyForm } from "./components/StudyForm";
import { StudyRow } from "./components/StudyRow";
import { countError, formValues, toNewItem, type StudyFormValues } from "./studyForm";

const KINDS = [
  { value: "decks", label: "Flashcards" },
  { value: "quizzes", label: "Tests" },
] as const;

const copy: Record<
  StudyKind,
  {
    create: string;
    sheetTitle: string;
    countLabel: string;
    count: (count: number) => string;
    emptyTitle: string;
    emptyMessage: string;
    path: string;
  }
> = {
  decks: {
    create: "Crear flashcards",
    sheetTitle: "Nuevas flashcards",
    countLabel: "Número de tarjetas",
    count: (count) => (count === 1 ? "1 tarjeta" : `${count} tarjetas`),
    emptyTitle: "Aún no hay flashcards",
    emptyMessage: "Créalas aquí o pídeselas al asistente en un chat.",
    path: "decks",
  },
  quizzes: {
    create: "Crear test",
    sheetTitle: "Nuevo test",
    countLabel: "Número de preguntas",
    count: (count) => (count === 1 ? "1 pregunta" : `${count} preguntas`),
    emptyTitle: "Aún no hay tests",
    emptyMessage: "Créalos aquí o pídeselos al asistente en un chat.",
    path: "quizzes",
  },
};

type FormErrors = { count?: string; form?: string };

type Props = { projectId: string };

/** The project's decks and quizzes, and where new ones are created. */
export function StudySection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [kind, setKind] = useState<StudyKind>("decks");
  const study = useProjectStudy(projectId, kind);
  const createItem = useCreateStudyItem(kind);
  const [values, setValues] = useState<StudyFormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  // Guards a second press that arrives before the loading state re-renders the button.
  const saving = useRef(false);
  const text = copy[kind];
  const canCreate = study.readyDocuments.length > 0;

  function openForm() {
    setErrors({});
    setValues(formValues(study.readyDocuments));
  }

  const closeForm = () => setValues(null);

  async function submit() {
    if (saving.current || !values) return;
    const error = countError(values);
    setErrors({ count: error });
    if (error) return;

    saving.current = true;
    try {
      await createItem.mutateAsync(toNewItem(values));
      closeForm();
    } catch (failure) {
      setErrors({ form: failure instanceof Error ? failure.message : String(failure) });
    } finally {
      saving.current = false;
    }
  }

  function open(item: StudyItem) {
    router.push(`/projects/${projectId}/${text.path}/${item.id}`);
  }

  return (
    <View style={styles.section}>
      <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
      <Button label={text.create} onPress={openForm} disabled={study.isPending || !canCreate} />
      {!study.isPending && !canCreate ? (
        <AppText variant="caption" color="textMuted">
          Sube un PDF primero.
        </AppText>
      ) : null}
      {study.error ? (
        <ErrorState message={study.error.message} onRetry={() => study.refetch()} />
      ) : study.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : (
        <FlatList
          data={study.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StudyRow item={item} countLabel={text.count} onOpen={open} />}
          ListEmptyComponent={<EmptyState title={text.emptyTitle} message={text.emptyMessage} />}
          style={styles.list}
          contentContainerStyle={styles.content}
        />
      )}
      <Sheet visible={values !== null} title={text.sheetTitle} onClose={closeForm}>
        {values ? (
          <StudyForm
            documents={study.readyDocuments}
            values={values}
            onChange={setValues}
            countLabel={text.countLabel}
            onSubmit={submit}
            onCancel={closeForm}
            countError={errors.count}
            error={errors.form}
            loading={createItem.isPending}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: { flex: 1, gap: theme.spacing.lg },
  list: { flex: 1 },
  content: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
});

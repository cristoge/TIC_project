import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, EmptyState, ErrorState, SegmentedControl, Sheet } from "@/shared/ui";

import {
  useCreateStudyItem,
  useDeleteStudyItem,
  useProjectStudy,
  useRenameStudyItem,
  type StudyItem,
  type StudyKind,
} from "./api";
import { StudyForm } from "./components/StudyForm";
import { StudyItemOptions } from "./components/StudyItemOptions";
import { StudyNameForm } from "./components/StudyNameForm";
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
    deleteTitle: string;
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
    deleteTitle: "¿Eliminar estas flashcards?",
    path: "decks",
  },
  quizzes: {
    create: "Crear test",
    sheetTitle: "Nuevo test",
    countLabel: "Número de preguntas",
    count: (count) => (count === 1 ? "1 pregunta" : `${count} preguntas`),
    emptyTitle: "Aún no hay tests",
    emptyMessage: "Créalos aquí o pídeselos al asistente en un chat.",
    deleteTitle: "¿Eliminar este test?",
    path: "quizzes",
  },
};

type FormErrors = { count?: string; form?: string };

// One sheet whose content changes: presenting a second Modal while the first is closing fails on iOS.
type SheetState =
  | { kind: "create"; values: StudyFormValues }
  | { kind: "options"; item: StudyItem }
  | { kind: "rename"; item: StudyItem; name: string };

type Props = { projectId: string };

/** The project's decks and quizzes, and where new ones are created. */
export function StudySection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [kind, setKind] = useState<StudyKind>("decks");
  const study = useProjectStudy(projectId, kind);
  const createItem = useCreateStudyItem(kind);
  const renameItem = useRenameStudyItem(kind);
  const deleteItem = useDeleteStudyItem(kind);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  // Guards a second press that arrives before the loading state re-renders the button.
  const saving = useRef(false);
  const text = copy[kind];
  const canCreate = study.readyDocuments.length > 0;

  function openForm() {
    setErrors({});
    setSheet({ kind: "create", values: formValues(study.readyDocuments) });
  }

  const closeSheet = () => setSheet(null);

  async function save(action: () => Promise<unknown>) {
    if (saving.current) return;
    saving.current = true;
    try {
      await action();
      closeSheet();
    } catch (failure) {
      setErrors({ form: messageOf(failure) });
    } finally {
      saving.current = false;
    }
  }

  function submitCreate() {
    if (sheet?.kind !== "create") return;
    const error = countError(sheet.values);
    setErrors({ count: error });
    if (error) return;
    const item = toNewItem(sheet.values);
    return save(() => createItem.mutateAsync(item));
  }

  function openRename(item: StudyItem) {
    setErrors({});
    setSheet({ kind: "rename", item, name: item.topic ?? "" });
  }

  function submitRename() {
    if (sheet?.kind !== "rename") return;
    const { item, name } = sheet;
    return save(() => renameItem.mutateAsync({ item, topic: name.trim() || null }));
  }

  // The alert opens over the options sheet and closes it on either answer.
  function confirmDelete(item: StudyItem) {
    Alert.alert(
      text.deleteTitle,
      "También desaparecerán del chat donde se crearon.",
      [
        { text: "Cancelar", style: "cancel", onPress: closeSheet },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            closeSheet();
            deleteItem.mutate(item, {
              onError: (failure) => Alert.alert("No se pudo eliminar", messageOf(failure)),
            });
          },
        },
      ],
      { cancelable: true, onDismiss: closeSheet },
    );
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
          renderItem={({ item }) => (
            <StudyRow
              item={item}
              countLabel={text.count}
              onOpen={open}
              onOptions={(chosen) => setSheet({ kind: "options", item: chosen })}
            />
          )}
          ListEmptyComponent={<EmptyState title={text.emptyTitle} message={text.emptyMessage} />}
          style={styles.list}
          contentContainerStyle={styles.content}
        />
      )}
      <Sheet
        visible={sheet !== null}
        title={
          sheet?.kind === "create"
            ? text.sheetTitle
            : sheet?.kind === "rename"
              ? "Renombrar"
              : (sheet?.item.title ?? "")
        }
        onClose={closeSheet}
      >
        {sheet?.kind === "create" ? (
          <StudyForm
            documents={study.readyDocuments}
            values={sheet.values}
            onChange={(values) => setSheet({ kind: "create", values })}
            countLabel={text.countLabel}
            onSubmit={submitCreate}
            onCancel={closeSheet}
            countError={errors.count}
            error={errors.form}
            loading={createItem.isPending}
          />
        ) : sheet?.kind === "options" ? (
          <StudyItemOptions
            onRename={() => openRename(sheet.item)}
            onDelete={() => confirmDelete(sheet.item)}
            onCancel={closeSheet}
          />
        ) : sheet ? (
          <StudyNameForm
            name={sheet.name}
            onChange={(name) => setSheet({ ...sheet, name })}
            onSubmit={submitRename}
            onCancel={closeSheet}
            error={errors.form}
            loading={renameItem.isPending}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

const createStyles = (theme: Theme) => ({
  section: { flex: 1, gap: theme.spacing.lg },
  list: { flex: 1 },
  content: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
});

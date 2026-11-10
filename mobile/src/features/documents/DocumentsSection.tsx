import { useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, ErrorState, Sheet } from "@/shared/ui";

import {
  useDeleteDocument,
  useDocuments,
  useRenameDocument,
  useUploadDocument,
  type Document,
} from "./api";
import { DocumentList } from "./components/DocumentList";
import { DocumentNameForm } from "./components/DocumentNameForm";
import { DocumentOptions } from "./components/DocumentOptions";
import { nameError, toChanges } from "./documentForm";

// One sheet whose content changes: presenting a second Modal while the first is closing fails on iOS.
type SheetState = { kind: "options" | "rename"; document: Document };

type FormErrors = { name?: string; form?: string };

type Props = { projectId: string };

export function DocumentsSection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const documents = useDocuments(projectId);
  const uploadDocument = useUploadDocument(projectId);
  const renameDocument = useRenameDocument(projectId);
  const deleteDocument = useDeleteDocument(projectId);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  // Guard a second press that arrives before the loading state re-renders the button.
  const uploading = useRef(false);
  const saving = useRef(false);

  async function upload() {
    if (uploading.current) return;
    uploading.current = true;
    try {
      await uploadDocument.mutateAsync();
    } catch {
      // Shown from the mutation's error below.
    } finally {
      uploading.current = false;
    }
  }

  function openRename(document: Document) {
    setName(document.name);
    setErrors({});
    setSheet({ kind: "rename", document });
  }

  const closeSheet = () => setSheet(null);

  async function submitRename() {
    if (saving.current || sheet?.kind !== "rename") return;
    const error = nameError(name);
    setErrors({ name: error });
    if (error) return;

    const changes = toChanges(sheet.document, name);
    if (!changes) return closeSheet();
    saving.current = true;
    try {
      await renameDocument.mutateAsync({ id: sheet.document.id, changes });
      closeSheet();
    } catch (failure) {
      setErrors({ form: messageOf(failure) });
    } finally {
      saving.current = false;
    }
  }

  // The alert opens over the options sheet and closes it on either answer.
  function confirmDelete(document: Document) {
    Alert.alert(
      "¿Eliminar documento?",
      "Se borrarán también sus resúmenes, flashcards y tests.",
      [
        { text: "Cancelar", style: "cancel", onPress: closeSheet },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            closeSheet();
            deleteDocument.mutate(document.id, {
              onError: (failure) =>
                Alert.alert("No se pudo eliminar el documento", messageOf(failure)),
            });
          },
        },
      ],
      { cancelable: true, onDismiss: closeSheet },
    );
  }

  return (
    <View style={styles.section}>
      <Button label="Subir PDF" onPress={upload} loading={uploadDocument.isPending} />
      {uploadDocument.error ? (
        <AppText color="danger" accessibilityRole="alert">
          {uploadDocument.error.message}
        </AppText>
      ) : null}
      {documents.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : documents.isError ? (
        <ErrorState message={documents.error.message} onRetry={() => documents.refetch()} />
      ) : (
        <DocumentList
          documents={documents.data}
          onOptions={(document) => setSheet({ kind: "options", document })}
        />
      )}
      <Sheet
        visible={sheet !== null}
        title={sheet?.kind === "rename" ? "Renombrar documento" : (sheet?.document.name ?? "")}
        onClose={closeSheet}
      >
        {sheet?.kind === "options" ? (
          <DocumentOptions
            onRename={() => openRename(sheet.document)}
            onDelete={() => confirmDelete(sheet.document)}
            onCancel={closeSheet}
          />
        ) : sheet ? (
          <DocumentNameForm
            name={name}
            onChange={setName}
            onSubmit={submitRename}
            onCancel={closeSheet}
            nameError={errors.name}
            error={errors.form}
            loading={renameDocument.isPending}
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
});

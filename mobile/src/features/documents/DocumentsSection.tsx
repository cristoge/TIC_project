import { useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, ErrorState, FloatingButton, Sheet } from "@/shared/ui";

import {
  useDeleteDocument,
  useDocuments,
  useRenameDocument,
  useUploadDocument,
  type Document,
} from "./api";
import { DocumentList } from "./components/DocumentList";
import { DocumentNameForm } from "./components/DocumentNameForm";
import { nameError, toChanges } from "./documentForm";

type FormErrors = { name?: string; form?: string };

type Props = { projectId: string };

export function DocumentsSection({ projectId }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const documents = useDocuments(projectId);
  const uploadDocument = useUploadDocument(projectId);
  const renameDocument = useRenameDocument(projectId);
  const deleteDocument = useDeleteDocument(projectId);
  // The rename form is the only sheet; the options and the delete confirmation are centred alerts.
  const [renaming, setRenaming] = useState<Document | null>(null);
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
    setRenaming(document);
  }

  const closeSheet = () => setRenaming(null);

  async function submitRename() {
    if (saving.current || !renaming) return;
    const error = nameError(name);
    setErrors({ name: error });
    if (error) return;

    const changes = toChanges(renaming, name);
    if (!changes) return closeSheet();
    saving.current = true;
    try {
      await renameDocument.mutateAsync({ id: renaming.id, changes });
      closeSheet();
    } catch (failure) {
      setErrors({ form: messageOf(failure) });
    } finally {
      saving.current = false;
    }
  }

  // A menu in the middle of the screen, like the one that deletes a chat.
  function openOptions(document: Document) {
    Alert.alert(
      document.name,
      undefined,
      [
        { text: "Renombrar", onPress: () => openRename(document) },
        { text: "Eliminar", style: "destructive", onPress: () => confirmDelete(document) },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true },
    );
  }

  function confirmDelete(document: Document) {
    Alert.alert(
      "¿Eliminar documento?",
      "Se borrarán también sus resúmenes, flashcards y tests.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () =>
            deleteDocument.mutate(document.id, {
              onError: (failure) =>
                Alert.alert("No se pudo eliminar el documento", messageOf(failure)),
            }),
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <View style={styles.section}>
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
        <DocumentList documents={documents.data} onOptions={openOptions} />
      )}
      <Sheet visible={renaming !== null} title="Renombrar documento" onClose={closeSheet}>
        <DocumentNameForm
          name={name}
          onChange={setName}
          onSubmit={submitRename}
          onCancel={closeSheet}
          nameError={errors.name}
          error={errors.form}
          loading={renameDocument.isPending}
        />
      </Sheet>
      <FloatingButton
        icon="upload"
        label="Subir PDF"
        onPress={upload}
        loading={uploadDocument.isPending}
      />
    </View>
  );
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

const createStyles = (theme: Theme) => ({
  section: { flex: 1, gap: theme.spacing.lg },
});

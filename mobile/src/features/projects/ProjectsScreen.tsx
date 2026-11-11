import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, ErrorState, IconButton, Screen, Sheet } from "@/shared/ui";

import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
  type Project,
} from "./api";
import { ProjectForm } from "./components/ProjectForm";
import { useLastProject } from "./lastProject";
import { ProjectList } from "./components/ProjectList";
import {
  formValues,
  nameError,
  toChanges,
  toNewProject,
  type ProjectFormValues,
} from "./projectForm";

// The create and rename forms share one sheet; the options and the delete confirmation are centred alerts.
type SheetState = { kind: "create" } | { kind: "rename"; project: Project };

type FormErrors = { name?: string; form?: string };

export function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const projects = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const currentId = useLastProject((state) => state.projectId);
  const styles = useThemedStyles(createStyles);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [values, setValues] = useState<ProjectFormValues>(formValues());
  const [errors, setErrors] = useState<FormErrors>({});
  // Guards a second submit that arrives before the loading state re-renders the button.
  const saving = useRef(false);

  function openForm(next: SheetState) {
    setValues(formValues(next.kind === "rename" ? next.project : undefined));
    setErrors({});
    setSheet(next);
  }

  const closeSheet = () => setSheet(null);

  async function submit() {
    if (saving.current || !sheet) return;
    const error = nameError(values);
    setErrors({ name: error });
    if (error) return;

    saving.current = true;
    try {
      if (sheet.kind === "create") {
        await createProject.mutateAsync(toNewProject(values));
      } else {
        const changes = toChanges(sheet.project, values);
        if (Object.keys(changes).length > 0) {
          await updateProject.mutateAsync({ id: sheet.project.id, changes });
        }
      }
      closeSheet();
    } catch (failure) {
      setErrors({ form: messageOf(failure) });
    } finally {
      saving.current = false;
    }
  }

  // A menu in the middle of the screen, like the one that deletes a chat.
  function openOptions(project: Project) {
    Alert.alert(
      project.name,
      undefined,
      [
        { text: "Renombrar", onPress: () => openForm({ kind: "rename", project }) },
        { text: "Eliminar", style: "destructive", onPress: () => confirmDelete(project) },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true },
    );
  }

  function confirmDelete(project: Project) {
    Alert.alert(
      "¿Eliminar proyecto?",
      "Se borrarán también sus documentos, chats y flashcards.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () =>
            deleteProject.mutate(project.id, {
              onError: (failure) =>
                Alert.alert("No se pudo eliminar el proyecto", messageOf(failure)),
            }),
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="title" accessibilityRole="header">
            Proyectos
          </AppText>
          {projects.data?.length ? (
            <AppText variant="caption" color="textMuted">
              {projects.data.length === 1 ? "1 proyecto" : `${projects.data.length} proyectos`}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon="add"
          label="Nuevo proyecto"
          variant="accent"
          onPress={() => openForm({ kind: "create" })}
        />
      </View>
      {projects.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : projects.isError ? (
        <ErrorState message={projects.error.message} onRetry={() => projects.refetch()} />
      ) : (
        <ProjectList
          projects={projects.data}
          currentId={currentId}
          onCreate={() => openForm({ kind: "create" })}
          onOpen={(project) => {
            // Back to the project underneath (opened from its menu), then swap it for this one.
            if (router.canDismiss()) router.dismissAll();
            router.replace(`/projects/${project.id}`);
          }}
          onOptions={openOptions}
        />
      )}
      <Sheet
        visible={sheet !== null}
        title={sheet?.kind === "rename" ? "Renombrar proyecto" : "Nuevo proyecto"}
        onClose={closeSheet}
      >
        <ProjectForm
          values={values}
          onChange={setValues}
          submitLabel={sheet?.kind === "rename" ? "Guardar" : "Crear"}
          onSubmit={submit}
          onCancel={closeSheet}
          nameError={errors.name}
          error={errors.form}
          loading={createProject.isPending || updateProject.isPending}
        />
      </Sheet>
    </Screen>
  );
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

const createStyles = (theme: Theme) => ({
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  heading: { gap: 2 },
});

import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";

import { useTheme } from "@/shared/theme";
import { Button, ErrorState, Screen, Sheet } from "@/shared/ui";

import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
  type Project,
} from "./api";
import { ProjectForm } from "./components/ProjectForm";
import { ProjectList } from "./components/ProjectList";
import { ProjectOptions } from "./components/ProjectOptions";
import {
  formValues,
  nameError,
  toChanges,
  toNewProject,
  type ProjectFormValues,
} from "./projectForm";

// One sheet whose content changes: presenting a second Modal while the first is closing fails on iOS.
type SheetState =
  { kind: "create" } | { kind: "options"; project: Project } | { kind: "rename"; project: Project };

type FormErrors = { name?: string; form?: string };

export function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const projects = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [values, setValues] = useState<ProjectFormValues>(formValues());
  const [errors, setErrors] = useState<FormErrors>({});
  // Guards a second submit that arrives before the loading state re-renders the button.
  const saving = useRef(false);

  function openForm(next: SheetState & { kind: "create" | "rename" }) {
    setValues(formValues(next.kind === "rename" ? next.project : undefined));
    setErrors({});
    setSheet(next);
  }

  const closeSheet = () => setSheet(null);

  async function submit() {
    if (saving.current || (sheet?.kind !== "create" && sheet?.kind !== "rename")) return;
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

  // The alert opens over the options sheet and closes it on either answer.
  function confirmDelete(project: Project) {
    Alert.alert(
      "¿Eliminar proyecto?",
      "Se borrarán también sus documentos, chats y flashcards.",
      [
        { text: "Cancelar", style: "cancel", onPress: closeSheet },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            closeSheet();
            deleteProject.mutate(project.id, {
              onError: (failure) =>
                Alert.alert("No se pudo eliminar el proyecto", messageOf(failure)),
            });
          },
        },
      ],
      { cancelable: true, onDismiss: closeSheet },
    );
  }

  return (
    <Screen>
      <Button label="Nuevo proyecto" onPress={() => openForm({ kind: "create" })} />
      {projects.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : projects.isError ? (
        <ErrorState message={projects.error.message} onRetry={() => projects.refetch()} />
      ) : (
        <ProjectList
          projects={projects.data}
          onOpen={(project) => router.push(`/projects/${project.id}`)}
          onOptions={(project) => setSheet({ kind: "options", project })}
        />
      )}
      <Sheet visible={sheet !== null} title={sheetTitle(sheet)} onClose={closeSheet}>
        {sheet?.kind === "options" ? (
          <ProjectOptions
            onRename={() => openForm({ kind: "rename", project: sheet.project })}
            onDelete={() => confirmDelete(sheet.project)}
            onCancel={closeSheet}
          />
        ) : sheet ? (
          <ProjectForm
            values={values}
            onChange={setValues}
            submitLabel={sheet.kind === "create" ? "Crear" : "Guardar"}
            onSubmit={submit}
            onCancel={closeSheet}
            nameError={errors.name}
            error={errors.form}
            loading={createProject.isPending || updateProject.isPending}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function sheetTitle(sheet: SheetState | null): string {
  if (sheet?.kind === "options") return sheet.project.name;
  if (sheet?.kind === "rename") return "Renombrar proyecto";
  return "Nuevo proyecto";
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

// The create/rename form's values and how they become request bodies.

import type { NewProject, Project, ProjectChanges } from "./api";

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;

export type ProjectFormValues = { name: string; description: string };

export function formValues(project?: Project): ProjectFormValues {
  return { name: project?.name ?? "", description: project?.description ?? "" };
}

export function nameError(values: ProjectFormValues): string | undefined {
  return values.name.trim() ? undefined : "Escribe un nombre.";
}

export function toNewProject(values: ProjectFormValues): NewProject {
  const name = values.name.trim();
  const description = values.description.trim();
  return description ? { name, description } : { name };
}

/** Only the fields that differ from `project`; a blank description becomes null, which clears it. */
export function toChanges(project: Project, values: ProjectFormValues): ProjectChanges {
  const changes: ProjectChanges = {};
  const name = values.name.trim();
  const description = values.description.trim() || null;
  if (name !== project.name) changes.name = name;
  if (description !== project.description) changes.description = description;
  return changes;
}

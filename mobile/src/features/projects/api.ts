import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApi } from "@/core/api";
import type { Schemas } from "@/shared/api";

import { projectKeys } from "./queryKeys";

export type Project = Schemas["ProjectOut"];
export type NewProject = Schemas["ProjectIn"];
export type ProjectChanges = Schemas["ProjectUpdate"];

const fetchProjects = () => getApi().get<Project[]>("/projects");

export function useProjects() {
  return useQuery({ queryKey: projectKeys.all, queryFn: fetchProjects });
}

/** The project's name for headers, read from the projects list. */
export function useProjectName(projectId: string): string {
  const { data } = useQuery({
    queryKey: projectKeys.all,
    queryFn: fetchProjects,
    select: (projects) => projects.find((project) => project.id === projectId)?.name,
  });
  return data ?? "Proyecto";
}

// Returning the promise keeps the mutation pending until the list has been refetched.
function useRefreshProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: projectKeys.all });
}

export function useCreateProject() {
  const refresh = useRefreshProjects();
  return useMutation({
    mutationFn: (project: NewProject) => getApi().post<Project>("/projects", project),
    onSuccess: refresh,
  });
}

export function useUpdateProject() {
  const refresh = useRefreshProjects();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ProjectChanges }) =>
      getApi().patch<Project>(`/projects/${id}`, changes),
    onSuccess: refresh,
  });
}

export function useDeleteProject() {
  const refresh = useRefreshProjects();
  return useMutation({
    mutationFn: (id: string) => getApi().delete(`/projects/${id}`),
    onSuccess: refresh,
  });
}

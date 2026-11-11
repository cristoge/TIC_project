import { Redirect } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

import { useLastProject, useProjects } from "@/features/projects";
import { useTheme } from "@/shared/theme";
import { Screen } from "@/shared/ui";

/** Where the app opens: a new chat in the last project used, or the projects list. */
export default function Start() {
  const theme = useTheme();
  const { projectId, restored } = useLastProject();
  const projects = useProjects();

  useEffect(() => {
    if (!restored) useLastProject.getState().restore();
  }, [restored]);

  if (!restored || (projectId && projects.isPending)) {
    return (
      <Screen>
        <ActivityIndicator color={theme.colors.textMuted} />
      </Screen>
    );
  }
  // A project deleted since, or a list that failed to load, falls back to the list and its error.
  const exists = projects.data?.some((project) => project.id === projectId);
  return <Redirect href={exists ? `/projects/${projectId}/chats/new` : "/projects"} />;
}

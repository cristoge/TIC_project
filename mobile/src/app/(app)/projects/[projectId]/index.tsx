import { Stack, useLocalSearchParams } from "expo-router";

import { ProjectScreen, useProjectName } from "@/features/projects";

export default function Project() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const title = useProjectName(projectId);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ProjectScreen />
    </>
  );
}

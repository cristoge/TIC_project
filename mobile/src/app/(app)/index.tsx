import { Stack } from "expo-router";

import { ProjectsScreen } from "@/features/projects";

export default function Index() {
  return (
    <>
      <Stack.Screen options={{ title: "Proyectos" }} />
      <ProjectsScreen />
    </>
  );
}

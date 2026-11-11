import { Stack } from "expo-router";

import { ProjectsScreen } from "@/features/projects";
import { SettingsButton } from "@/features/settings";

export default function Projects() {
  return (
    <>
      <Stack.Screen options={{ title: "Proyectos", headerRight: () => <SettingsButton /> }} />
      <ProjectsScreen />
    </>
  );
}

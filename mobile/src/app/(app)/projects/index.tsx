import { Stack } from "expo-router";

import { ProjectsScreen } from "@/features/projects";
import { SettingsButton } from "@/features/settings";

export default function Projects() {
  return (
    <>
      {/* The screen shows its own large title, so the bar keeps only the settings button. */}
      <Stack.Screen options={{ title: "", headerRight: () => <SettingsButton /> }} />
      <ProjectsScreen />
    </>
  );
}

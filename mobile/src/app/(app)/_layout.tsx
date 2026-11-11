import { Stack } from "expo-router";

import { useStackScreenOptions } from "@/core/navigation";

export default function AppLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      {/* The start screen only redirects; a project brings its own menu and headers. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="projects/[projectId]" options={{ headerShown: false }} />
    </Stack>
  );
}

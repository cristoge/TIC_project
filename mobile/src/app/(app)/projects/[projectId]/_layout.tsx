import { Stack } from "expo-router";

import { useStackScreenOptions } from "@/core/navigation";

/** The project's menu, with a deck or quiz opened on top of it and a back button to return. */
export default function ProjectLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="(menu)" options={{ headerShown: false }} />
    </Stack>
  );
}

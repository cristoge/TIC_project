import { Stack } from "expo-router";

import { AppText, Screen } from "@/shared/ui";

// Placeholder until the projects list (T4).
export default function Index() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Proyectos" }} />
      <AppText variant="title">Proyectos</AppText>
      <AppText color="textMuted">Aquí irá la lista de proyectos.</AppText>
    </Screen>
  );
}

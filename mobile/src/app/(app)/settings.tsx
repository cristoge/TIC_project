import { Stack } from "expo-router";

import { SettingsScreen } from "@/features/settings";

export default function Settings() {
  return (
    <>
      <Stack.Screen options={{ title: "Ajustes" }} />
      <SettingsScreen />
    </>
  );
}

import { Stack } from "expo-router";

import { useStackScreenOptions } from "@/core/navigation";

export default function AppLayout() {
  return <Stack screenOptions={useStackScreenOptions()} />;
}

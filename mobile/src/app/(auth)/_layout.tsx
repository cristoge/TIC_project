import { Stack } from "expo-router";

import { useStackScreenOptions } from "@/core/navigation";

export default function AuthLayout() {
  return <Stack screenOptions={useStackScreenOptions()} />;
}

import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { AppText } from "@/shared/ui";

/** The header button on Projects that opens Ajustes. */
export function SettingsButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      hitSlop={8}
      onPress={() => router.push("/settings")}
    >
      <AppText variant="label">Ajustes</AppText>
    </Pressable>
  );
}

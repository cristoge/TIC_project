import { useRouter } from "expo-router";
import { IconButton } from "@/shared/ui";

/** The header button on Projects that opens Ajustes. */
export function SettingsButton() {
  const router = useRouter();

  return <IconButton icon="settings" label="Ajustes" onPress={() => router.push("/settings")} />;
}

import { useLocalSearchParams } from "expo-router";

import { ChatsSection } from "@/features/chat";
import { Screen } from "@/shared/ui";

export default function Chats() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return (
    <Screen>
      <ChatsSection projectId={projectId} />
    </Screen>
  );
}

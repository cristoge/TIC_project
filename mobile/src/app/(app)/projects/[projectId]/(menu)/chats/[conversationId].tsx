import { useLocalSearchParams, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatScreen, conversationTitle, useConversations } from "@/features/chat";
import { IconButton } from "@/shared/ui";

/** The path segment of a chat that has not been created yet. */
const NEW = "new";
/** Height of the navigation bar below the status bar. */
const HEADER_HEIGHT = 44;

export default function Chat() {
  const { projectId, conversationId } = useLocalSearchParams<{
    projectId: string;
    conversationId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: conversations } = useConversations(projectId);
  const conversation = conversations?.find((candidate) => candidate.id === conversationId);

  return (
    <>
      <Drawer.Screen
        options={{
          title: conversation ? conversationTitle(conversation) : "Nuevo chat",
          headerRight: () => (
            <IconButton
              icon="newChat"
              label="Nuevo chat"
              onPress={() => router.navigate(`/projects/${projectId}/chats/new`)}
            />
          ),
        }}
      />
      <ChatScreen
        projectId={projectId}
        conversationId={conversationId === NEW ? null : conversationId}
        // Keeps the route pointing at the chat once its first message has created it.
        onCreated={(id) => router.setParams({ conversationId: id })}
        onOpenArtifact={({ kind, id }) =>
          router.push(`/projects/${projectId}/${kind === "quiz" ? "quizzes" : "decks"}/${id}`)
        }
        keyboardOffset={insets.top + HEADER_HEIGHT}
      />
    </>
  );
}

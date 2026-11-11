import { Redirect, useLocalSearchParams } from "expo-router";

/** A project opens on a new chat, as the Claude app does. */
export default function ProjectStart() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <Redirect href={`/projects/${projectId}/chats/new`} />;
}

import { useLocalSearchParams } from "expo-router";

import { DocumentsSection } from "@/features/documents";
import { Screen } from "@/shared/ui";

export default function Documents() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return (
    <Screen>
      <DocumentsSection projectId={projectId} />
    </Screen>
  );
}

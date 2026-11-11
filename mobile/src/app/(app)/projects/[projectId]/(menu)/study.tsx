import { useLocalSearchParams } from "expo-router";

import { StudySection } from "@/features/study";
import { Screen } from "@/shared/ui";

export default function Study() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return (
    <Screen>
      <StudySection projectId={projectId} />
    </Screen>
  );
}

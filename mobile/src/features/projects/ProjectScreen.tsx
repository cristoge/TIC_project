import { useState } from "react";

import { ChatsSection } from "@/features/chat";
import { DocumentsSection } from "@/features/documents";
import { StudySection } from "@/features/study";
import { Screen, SegmentedControl } from "@/shared/ui";

type Section = "chats" | "documents" | "study";

const SECTIONS = [
  { value: "chats", label: "Chats" },
  { value: "documents", label: "Documentos" },
  { value: "study", label: "Estudio" },
] as const;

type Props = { projectId: string };

export function ProjectScreen({ projectId }: Props) {
  // Documents first: nothing else in a project works until a PDF is uploaded.
  const [section, setSection] = useState<Section>("documents");

  return (
    <Screen>
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      {section === "documents" ? (
        <DocumentsSection projectId={projectId} />
      ) : section === "chats" ? (
        <ChatsSection projectId={projectId} />
      ) : (
        <StudySection projectId={projectId} />
      )}
    </Screen>
  );
}

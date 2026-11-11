import { memo } from "react";
import { View } from "react-native";

import { ArtifactCard } from "@/features/study";
import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText } from "@/shared/ui";

import type { Source } from "../stream";
import type { Artifact } from "../useChat";
import { MarkdownText } from "./MarkdownText";

type Props = {
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  artifacts: Artifact[];
  onCitation: (source: Source) => void;
  /** Where a deck or quiz card leads; without it those cards offer no action. */
  onOpenArtifact?: (artifact: Artifact) => void;
};

// Memoized so each token of the answer being written does not render the whole history again.
export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  sources,
  artifacts,
  onCitation,
  onOpenArtifact,
}: Props) {
  const styles = useThemedStyles(createStyles);

  if (role === "user") {
    return (
      <View style={styles.user}>
        <AppText>{content}</AppText>
      </View>
    );
  }

  return (
    <View style={styles.assistant}>
      {content ? <MarkdownText value={content} sources={sources} onCitation={onCitation} /> : null}
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          kind={artifact.kind}
          id={artifact.id}
          onOpen={
            onOpenArtifact && artifact.kind !== "summary"
              ? () => onOpenArtifact(artifact)
              : undefined
          }
        />
      ))}
    </View>
  );
});

const createStyles = (theme: Theme) => ({
  user: {
    alignSelf: "flex-end" as const,
    maxWidth: "85%" as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
  },
  assistant: { gap: theme.spacing.sm },
});

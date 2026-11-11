import { useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Button, Card, ErrorState } from "@/shared/ui";

import { useDeck, useQuiz, useSummary, type SummaryContent } from "../api";

export type ArtifactKind = "summary" | "flashcards" | "quiz";

type Props = {
  kind: ArtifactKind;
  id: string;
  /** Where "Estudiar" or "Hacer test" leads; without it the card offers no action. */
  onOpen?: () => void;
};

/** A summary, deck or quiz the agent created, shown where it was created. */
export function ArtifactCard({ kind, id, onOpen }: Props) {
  if (kind === "summary") return <SummaryCard id={id} />;
  if (kind === "flashcards") return <DeckCard id={id} onOpen={onOpen} />;
  return <QuizCard id={id} onOpen={onOpen} />;
}

function SummaryCard({ id }: { id: string }) {
  const styles = useThemedStyles(createStyles);
  const summary = useSummary(id);
  const [expanded, setExpanded] = useState(false);
  const content = summary.data?.content as SummaryContent | null | undefined;

  return (
    <Generation title="Resumen" query={summary}>
      {content ? (
        <>
          <AppText>{content.overview}</AppText>
          {expanded ? (
            <>
              {content.sections.map((section) => (
                <View key={section.heading} style={styles.block}>
                  <AppText variant="label">{section.heading}</AppText>
                  {section.points.map((point) => (
                    <AppText key={point}>• {point}</AppText>
                  ))}
                </View>
              ))}
              {content.key_terms.map((keyTerm) => (
                <View key={keyTerm.term} style={styles.block}>
                  <AppText variant="label">{keyTerm.term}</AppText>
                  <AppText color="textMuted">{keyTerm.definition}</AppText>
                </View>
              ))}
            </>
          ) : null}
          <Button
            label={expanded ? "Ver menos" : "Ver completo"}
            variant="secondary"
            onPress={() => setExpanded(!expanded)}
          />
        </>
      ) : null}
    </Generation>
  );
}

function DeckCard({ id, onOpen }: Omit<Props, "kind">) {
  const deck = useDeck(id);
  const cards = deck.data?.cards.length ?? 0;

  return (
    <Generation title="Flashcards" query={deck}>
      <AppText color="textMuted">
        {details(deck.data?.topic, cards === 1 ? "1 tarjeta" : `${cards} tarjetas`)}
      </AppText>
      {onOpen ? <Button label="Estudiar" onPress={onOpen} /> : null}
    </Generation>
  );
}

function QuizCard({ id, onOpen }: Omit<Props, "kind">) {
  const quiz = useQuiz(id);
  const questions = quiz.data?.questions.length ?? 0;

  return (
    <Generation title="Test" query={quiz}>
      <AppText color="textMuted">
        {details(quiz.data?.topic, questions === 1 ? "1 pregunta" : `${questions} preguntas`)}
      </AppText>
      {onOpen ? <Button label="Hacer test" onPress={onOpen} /> : null}
    </Generation>
  );
}

function details(topic: string | null | undefined, count: string): string {
  return topic ? `${topic} · ${count}` : count;
}

type GenerationQuery = {
  data?: { status: "pending" | "ready" | "failed"; error_message: string | null };
  isPending: boolean;
  error: Error | null;
  refetch: () => unknown;
};

type GenerationProps = {
  title: string;
  query: GenerationQuery;
  /** Shown once the artifact is ready. */
  children: ReactNode;
};

/** The card's frame: its title and whichever state the generation is in. */
function Generation({ title, query, children }: GenerationProps) {
  const theme = useTheme();
  const { data } = query;

  return (
    <Card>
      <AppText variant="label">{title}</AppText>
      {data?.status === "ready" ? (
        children
      ) : data?.status === "pending" ? (
        <Badge label="Generando…" tone="progress" />
      ) : data ? (
        <>
          <Badge label="No se pudo generar" tone="danger" />
          {data.error_message ? (
            <AppText variant="caption" color="textMuted">
              {data.error_message}
            </AppText>
          ) : null}
        </>
      ) : query.isPending ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : (
        <ErrorState
          message={query.error?.message ?? ""}
          onRetry={() => {
            query.refetch();
          }}
        />
      )}
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  block: { gap: theme.spacing.xs },
});

import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Button, Card } from "@/shared/ui";

import type { Attempt, Quiz } from "../api";

type Props = {
  quiz: Quiz;
  attempt: Attempt;
  onRepeat: () => void;
};

export function QuizResult({ quiz, attempt, onRepeat }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.result}>
      <View style={styles.score}>
        <AppText variant="caption" color="textMuted">
          Nota
        </AppText>
        <AppText variant="title">
          {attempt.score} / {attempt.total}
        </AppText>
      </View>
      {attempt.answers.map((graded) => {
        const question = quiz.questions.find((candidate) => candidate.id === graded.question_id);
        if (!question) return null;
        return (
          <Card key={graded.question_id}>
            <Badge
              label={graded.is_correct ? "Acertada" : "Fallada"}
              tone={graded.is_correct ? "progress" : "danger"}
            />
            <AppText variant="label">{question.question}</AppText>
            {graded.is_correct ? null : (
              <AppText color="textMuted">
                Tu respuesta: {question.options[graded.selected_index]}
              </AppText>
            )}
            <AppText>Correcta: {question.options[graded.correct_index]}</AppText>
            <AppText variant="caption" color="textMuted">
              {graded.explanation}
            </AppText>
          </Card>
        );
      })}
      <Button label="Repetir" variant="secondary" onPress={onRepeat} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  result: { gap: theme.spacing.md },
  score: { alignItems: "center" as const, paddingVertical: theme.spacing.lg },
});

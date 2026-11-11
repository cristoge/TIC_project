import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, RadioOption, Screen } from "@/shared/ui";

import { useGradeQuiz, useQuiz, type Answers } from "./api";
import { GenerationState } from "./components/GenerationState";
import { QuizResult } from "./components/QuizResult";

type Props = { quizId: string };

/** Take a quiz one question at a time, then see it graded. */
export function QuizScreen({ quizId }: Props) {
  const styles = useThemedStyles(createStyles);
  const quiz = useQuiz(quizId);
  const grade = useGradeQuiz(quizId);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // Guards a second press that arrives before the loading state re-renders the button.
  const grading = useRef(false);

  const questions = quiz.data?.status === "ready" ? quiz.data.questions : [];
  const question = questions[index];
  const last = index === questions.length - 1;

  async function submit() {
    if (grading.current) return;
    grading.current = true;
    try {
      await grade.mutateAsync(answers);
    } catch {
      // Shown from the mutation's error below; the answers stay for a retry.
    } finally {
      grading.current = false;
    }
  }

  function repeat() {
    grade.reset();
    setAnswers({});
    setIndex(0);
  }

  if (quiz.data && grade.data) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <QuizResult quiz={quiz.data} attempt={grade.data} onRepeat={repeat} />
      </ScrollView>
    );
  }

  return (
    <Screen>
      <GenerationState
        query={quiz}
        pendingText="Generando el test…"
        failedText="No se pudo generar el test"
      />
      {question ? (
        <>
          <AppText variant="caption" color="textMuted">
            Pregunta {index + 1} / {questions.length}
          </AppText>
          <AppText variant="heading">{question.question}</AppText>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {question.options.map((option, optionIndex) => (
              <RadioOption
                key={optionIndex}
                label={option}
                checked={answers[question.id] === optionIndex}
                onPress={() => setAnswers({ ...answers, [question.id]: optionIndex })}
              />
            ))}
          </View>
          {grade.error ? (
            <AppText color="danger" accessibilityRole="alert">
              {grade.error.message}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="Anterior"
                variant="secondary"
                disabled={index === 0 || grade.isPending}
                onPress={() => setIndex(index - 1)}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={last ? "Corregir" : "Siguiente"}
                disabled={answers[question.id] === undefined}
                loading={last && grade.isPending}
                onPress={last ? submit : () => setIndex(index + 1)}
              />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const createStyles = (theme: Theme) => ({
  scroll: { padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  options: { gap: theme.spacing.sm },
  actions: { flexDirection: "row" as const, gap: theme.spacing.sm, marginTop: "auto" as const },
  action: { flex: 1 },
});

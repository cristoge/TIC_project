import { Stack, useLocalSearchParams } from "expo-router";

import { QuizScreen, useQuiz } from "@/features/study";

export default function Quiz() {
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const { data: quiz } = useQuiz(quizId);

  return (
    <>
      <Stack.Screen options={{ title: quiz?.topic || "Test" }} />
      <QuizScreen quizId={quizId} />
    </>
  );
}

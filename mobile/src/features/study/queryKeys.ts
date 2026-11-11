/** Query keys of the study artifacts: one by id from wherever it is shown, and each document's lists. */
export const studyKeys = {
  summary: (id: string) => ["summaries", id] as const,
  deck: (id: string) => ["flashcard-decks", id] as const,
  quiz: (id: string) => ["quizzes", id] as const,
  decksOf: (documentId: string) => ["documents", documentId, "flashcard-decks"] as const,
  quizzesOf: (documentId: string) => ["documents", documentId, "quizzes"] as const,
};

/** Query keys of the study artifacts, which are fetched by id from wherever they are shown. */
export const studyKeys = {
  summary: (id: string) => ["summaries", id] as const,
  deck: (id: string) => ["flashcard-decks", id] as const,
  quiz: (id: string) => ["quizzes", id] as const,
};

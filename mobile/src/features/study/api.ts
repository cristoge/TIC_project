import { useQuery, type Query } from "@tanstack/react-query";

import { getApi } from "@/core/api";
import type { Schemas } from "@/shared/api";

import { studyKeys } from "./queryKeys";

export type Summary = Schemas["SummaryOut"];
export type Deck = Schemas["DeckOut"];
export type Quiz = Schemas["QuizOut"];

/** The API types a summary's content as a free object; this is the shape the backend writes. */
export type SummaryContent = {
  overview: string;
  sections: { heading: string; points: string[]; pages: number[] }[];
  key_terms: { term: string; definition: string }[];
};

/** How often an artifact is refetched while the backend is still generating it. */
export const GENERATION_POLL_MS = 3000;

type Generated = { status: "pending" | "ready" | "failed" };

function pollWhilePending<T extends Generated>(query: Query<T, Error, T, readonly string[]>) {
  return query.state.data?.status === "pending" ? GENERATION_POLL_MS : false;
}

export function useSummary(id: string) {
  return useQuery({
    queryKey: studyKeys.summary(id),
    queryFn: () => getApi().get<Summary>(`/summaries/${id}`),
    refetchInterval: pollWhilePending,
  });
}

export function useDeck(id: string) {
  return useQuery({
    queryKey: studyKeys.deck(id),
    queryFn: () => getApi().get<Deck>(`/flashcard-decks/${id}`),
    refetchInterval: pollWhilePending,
  });
}

export function useQuiz(id: string) {
  return useQuery({
    queryKey: studyKeys.quiz(id),
    queryFn: () => getApi().get<Quiz>(`/quizzes/${id}`),
    refetchInterval: pollWhilePending,
  });
}

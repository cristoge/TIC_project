import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";

import { getApi } from "@/core/api";
import { useDocuments, type Document } from "@/features/documents";
import type { Schemas } from "@/shared/api";

import { studyKeys } from "./queryKeys";

export type Summary = Schemas["SummaryOut"];
export type Deck = Schemas["DeckOut"];
export type Quiz = Schemas["QuizOut"];
export type Attempt = Schemas["AttemptOut"];
/** The option index chosen for each question, by question id. */
export type Answers = Record<string, number>;

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

export function useGradeQuiz(quizId: string) {
  return useMutation({
    mutationFn: (answers: Answers) =>
      getApi().post<Attempt>(`/quizzes/${quizId}/attempts`, { answers }),
  });
}

/** Decks and quizzes, the two things a project's study tab lists and creates. */
export type StudyKind = "decks" | "quizzes";

export type StudyItem = {
  id: string;
  documentId: string;
  topic: string | null;
  /** The topic, or "Flashcards 2" / "Test 2" when it has none. */
  title: string;
  /** Cards or questions it holds once ready. */
  count: number;
  status: Generated["status"];
  error_message: string | null;
  created_at: string;
  documentName: string;
};

const paths: Record<StudyKind, (documentId: string) => string> = {
  decks: (documentId) => `/documents/${documentId}/flashcard-decks`,
  quizzes: (documentId) => `/documents/${documentId}/quizzes`,
};

const listKeys: Record<StudyKind, (documentId: string) => readonly string[]> = {
  decks: studyKeys.decksOf,
  quizzes: studyKeys.quizzesOf,
};

function isReady(document: Document): boolean {
  return document.status === "ready";
}

/**
 * The project's decks or quizzes, newest first. The API lists them per document, so this asks each
 * ready document and polls a list while any of its items is still being generated.
 */
export function useProjectStudy(projectId: string, kind: StudyKind) {
  const documents = useDocuments(projectId);
  const ready = (documents.data ?? []).filter(isReady);
  const lists = useQueries({
    queries: ready.map((document) => ({
      queryKey: listKeys[kind](document.id),
      queryFn: () => getApi().get<(Deck | Quiz)[]>(paths[kind](document.id)),
      refetchInterval: (
        query: Query<(Deck | Quiz)[], Error, (Deck | Quiz)[], readonly string[]>,
      ) =>
        query.state.data?.some((item) => item.status === "pending") ? GENERATION_POLL_MS : false,
    })),
  });

  const items: StudyItem[] = lists
    .flatMap((list, index) =>
      (list.data ?? []).map((item) => ({
        id: item.id,
        documentId: item.document_id,
        topic: item.topic?.trim() || null,
        title: "",
        // The lists leave the cards and questions out and carry how many there are.
        count: "card_count" in item ? item.card_count : item.question_count,
        status: item.status,
        error_message: item.error_message,
        created_at: item.created_at,
        documentName: ready[index].name,
      })),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  numberUntitled(items, UNTITLED[kind]);
  const failed = lists.filter((list) => list.isError);

  return {
    readyDocuments: ready,
    items,
    isPending: documents.isPending || lists.some((list) => list.isPending),
    error: documents.error ?? failed[0]?.error ?? null,
    refetch: () => {
      if (documents.isError) return documents.refetch();
      return Promise.all(failed.map((list) => list.refetch()));
    },
  };
}

const UNTITLED: Record<StudyKind, string> = { decks: "Flashcards", quizzes: "Test" };

/** Untitled items are numbered by creation, the oldest being 1; `items` is newest first. */
function numberUntitled(items: StudyItem[], label: string) {
  let number = items.filter((item) => !item.topic).length;
  for (const item of items) item.title = item.topic ?? `${label} ${number--}`;
}

export type NewStudyItem = { documentId: string; count: number; topic: string | null };

export function useCreateStudyItem(kind: StudyKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, count, topic }: NewStudyItem) =>
      getApi().post<Deck | Quiz>(paths[kind](documentId), { count, topic }),
    // Returning the promise keeps the mutation pending until the list has been refetched.
    onSuccess: (_created, { documentId }) =>
      queryClient.invalidateQueries({ queryKey: listKeys[kind](documentId) }),
  });
}

const itemPaths: Record<StudyKind, (id: string) => string> = {
  decks: (id) => `/flashcard-decks/${id}`,
  quizzes: (id) => `/quizzes/${id}`,
};

const itemKeys: Record<StudyKind, (id: string) => readonly string[]> = {
  decks: studyKeys.deck,
  quizzes: studyKeys.quiz,
};

/** After a change, refetch the item's list, the item itself and the chats, whose cards link to it. */
function useRefreshAfterEdit(kind: StudyKind) {
  const queryClient = useQueryClient();
  return (item: Pick<StudyItem, "id" | "documentId">) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: listKeys[kind](item.documentId) }),
      queryClient.invalidateQueries({ queryKey: itemKeys[kind](item.id) }),
      // Chat messages live under ["conversations", id, "messages"]; a deleted item's link becomes null.
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);
}

export function useRenameStudyItem(kind: StudyKind) {
  const refresh = useRefreshAfterEdit(kind);
  return useMutation({
    mutationFn: ({ item, topic }: { item: StudyItem; topic: string | null }) =>
      getApi().patch<Deck | Quiz>(itemPaths[kind](item.id), { topic }),
    onSuccess: (_renamed, { item }) => refresh(item),
  });
}

export function useDeleteStudyItem(kind: StudyKind) {
  const refresh = useRefreshAfterEdit(kind);
  return useMutation({
    mutationFn: (item: StudyItem) => getApi().delete(itemPaths[kind](item.id)),
    onSuccess: (_deleted, item) => refresh(item),
  });
}

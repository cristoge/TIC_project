import type { Deck, Quiz, Summary } from "../api";

export function aSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    id: "s1",
    document_id: "d1",
    status: "ready",
    content: {
      overview: "El tema presenta los grafos.",
      sections: [{ heading: "Definiciones", points: ["Nodo", "Arista"], pages: [1, 2] }],
      key_terms: [{ term: "Grado", definition: "Número de aristas de un nodo." }],
    },
    error_message: null,
    created_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

export function aDeck(overrides: Partial<Deck> = {}): Deck {
  const deck = {
    id: "f1",
    document_id: "d1",
    topic: "Grafos",
    requested_count: 2,
    status: "ready" as const,
    error_message: null,
    created_at: "2026-11-01T10:00:00Z",
    cards: [
      { question: "¿Qué es un nodo?", answer: "Un vértice.", page: 1 },
      { question: "¿Qué es una arista?", answer: "Una unión.", page: 2 },
    ],
    ...overrides,
  };
  return { card_count: deck.cards.length, ...deck };
}

/** A deck as the per-document list returns it: its count, without its cards. */
export function listedDeck(deck: Deck): Deck {
  return { ...deck, cards: [] };
}

export function aQuiz(overrides: Partial<Quiz> = {}): Quiz {
  const quiz = {
    id: "q1",
    document_id: "d1",
    topic: null,
    requested_count: 1,
    status: "ready" as const,
    error_message: null,
    created_at: "2026-11-01T10:00:00Z",
    questions: [
      { id: "qq1", question: "¿Qué es un nodo?", options: ["a", "b", "c", "d"], page: 1 },
    ],
    ...overrides,
  };
  return { question_count: quiz.questions.length, ...quiz };
}

/** A quiz as the per-document list returns it: its count, without its questions. */
export function listedQuiz(quiz: Quiz): Quiz {
  return { ...quiz, questions: [] };
}

import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { QuizScreen } from "./QuizScreen";
import { aQuiz } from "./testing/artifacts";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

const quiz = aQuiz({
  requested_count: 2,
  questions: [
    {
      id: "q1",
      question: "¿Qué es un nodo?",
      options: ["Un vértice", "Una arista", "Un peso", "Un camino"],
      page: 1,
    },
    {
      id: "q2",
      question: "¿Qué une una arista?",
      options: ["Pesos", "Dos nodos", "Caminos", "Grafos"],
      page: 2,
    },
  ],
});

const graded = {
  attempt_id: "a1",
  score: 1,
  total: 2,
  answers: [
    {
      question_id: "q1",
      selected_index: 0,
      correct_index: 0,
      is_correct: true,
      explanation: "Nodo y vértice son sinónimos.",
    },
    {
      question_id: "q2",
      selected_index: 2,
      correct_index: 1,
      is_correct: false,
      explanation: "Una arista une dos nodos.",
    },
  ],
};

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockApi.get.mockResolvedValue(quiz);
});

async function answer(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.press(screen.getByRole("radio", { name: option }));
}

async function answerAll() {
  const user = userEvent.setup();
  await renderWithQueryClient(<QuizScreen quizId="q1" />);
  await screen.findByText("¿Qué es un nodo?");
  await answer(user, "Un vértice");
  await user.press(screen.getByRole("button", { name: "Siguiente" }));
  await answer(user, "Caminos");
  await user.press(screen.getByRole("button", { name: "Corregir" }));
  return user;
}

describe("QuizScreen", () => {
  it("asks one question at a time and moves on once an option is chosen", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<QuizScreen quizId="q1" />);

    expect(await screen.findByText("¿Qué es un nodo?")).toBeOnTheScreen();
    expect(screen.getByText("Pregunta 1 / 2")).toBeOnTheScreen();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(mockApi.get).toHaveBeenCalledWith("/quizzes/q1");

    await answer(user, "Un vértice");

    expect(screen.getByRole("radio", { name: "Un vértice" })).toBeChecked();
    await user.press(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("¿Qué une una arista?")).toBeOnTheScreen();
    expect(screen.getByText("Pregunta 2 / 2")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Corregir" })).toBeDisabled();
  });

  it("grades the answers and shows the score, the correct option and why", async () => {
    mockApi.post.mockResolvedValue(graded);
    await answerAll();

    expect(await screen.findByText("1 / 2")).toBeOnTheScreen();
    expect(mockApi.post).toHaveBeenCalledWith("/quizzes/q1/attempts", {
      answers: { q1: 0, q2: 2 },
    });
    expect(screen.getByText("Nodo y vértice son sinónimos.")).toBeOnTheScreen();
    expect(screen.getByText("Una arista une dos nodos.")).toBeOnTheScreen();
    expect(screen.getByText("Tu respuesta: Caminos")).toBeOnTheScreen();
    expect(screen.getByText("Correcta: Dos nodos")).toBeOnTheScreen();
    expect(screen.getAllByText("Correcta: Un vértice")).toHaveLength(1);
    expect(screen.getByText("Acertada")).toBeOnTheScreen();
    expect(screen.getByText("Fallada")).toBeOnTheScreen();
  });

  it("starts again from the first question", async () => {
    mockApi.post.mockResolvedValue(graded);
    const user = await answerAll();
    await screen.findByText("1 / 2");

    await user.press(screen.getByRole("button", { name: "Repetir" }));

    expect(screen.getByText("Pregunta 1 / 2")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Un vértice" })).not.toBeChecked();
  });

  it("keeps the answers when grading fails, and retries", async () => {
    mockApi.post.mockRejectedValueOnce(new Error("Network request failed"));
    mockApi.post.mockResolvedValue(graded);
    const user = await answerAll();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network request failed");
    await user.press(screen.getByRole("button", { name: "Corregir" }));

    expect(await screen.findByText("1 / 2")).toBeOnTheScreen();
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(2));
    expect(mockApi.post.mock.calls[1][1]).toEqual({ answers: { q1: 0, q2: 2 } });
  });

  it("says when the quiz is still being generated", async () => {
    mockApi.get.mockResolvedValue(aQuiz({ status: "pending", questions: [] }));
    await renderWithQueryClient(<QuizScreen quizId="q1" />);

    expect(await screen.findByText("Generando el test…")).toBeOnTheScreen();
  });

  it("shows why the quiz could not be generated", async () => {
    mockApi.get.mockResolvedValue(
      aQuiz({ status: "failed", error_message: "The document has no text.", questions: [] }),
    );
    await renderWithQueryClient(<QuizScreen quizId="q1" />);

    expect(await screen.findByText("No se pudo generar el test")).toBeOnTheScreen();
    expect(screen.getByText("The document has no text.")).toBeOnTheScreen();
  });
});

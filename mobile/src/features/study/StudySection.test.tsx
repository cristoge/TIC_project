import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { aDocument } from "@/features/documents/testing/documents";
import { ApiError } from "@/shared/api";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { StudySection } from "./StudySection";
import { aDeck, aQuiz } from "./testing/artifacts";

const mockApi = createFakeApi();
const mockPush = jest.fn();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const tema1 = aDocument({ id: "d1", name: "Tema 1.pdf", status: "ready" });
const tema2 = aDocument({ id: "d2", name: "Tema 2.pdf", status: "ready" });
const processing = aDocument({ id: "d3", name: "Tema 3.pdf", status: "processing" });

const older = aDeck({ id: "f1", topic: "Grafos", created_at: "2026-11-01T10:00:00Z" });
const newer = aDeck({
  id: "f2",
  document_id: "d2",
  topic: null,
  created_at: "2026-11-03T10:00:00Z",
  cards: [{ question: "¿Qué es un árbol?", answer: "Un grafo sin ciclos.", page: 4 }],
});
const generating = aDeck({ id: "f3", topic: "Caminos", status: "pending", cards: [] });
const quiz = aQuiz({ id: "q1", topic: "Repaso" });

type Server = Record<string, unknown>;

function serve(server: Server) {
  mockApi.get.mockImplementation(async (path: string) => {
    if (!(path in server)) throw new Error(`Unexpected GET ${path}`);
    return server[path];
  });
}

const server: Server = {
  "/projects/p1/documents": [tema1, tema2, processing],
  "/documents/d1/flashcard-decks": [older],
  "/documents/d2/flashcard-decks": [newer],
  "/documents/d1/quizzes": [quiz],
  "/documents/d2/quizzes": [],
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of Object.values(mockApi)) method.mockReset();
  serve(server);
});

async function openCreateForm(label = "Crear flashcards") {
  const user = userEvent.setup();
  const button = await screen.findByRole("button", { name: label });
  // It waits for the documents, the ones a new deck or quiz can come from.
  await waitFor(() => expect(button).toBeEnabled());
  await user.press(button);
  return user;
}

describe("StudySection", () => {
  it("lists the decks of every ready document, newest first", async () => {
    await renderWithQueryClient(<StudySection projectId="p1" />);

    expect(await screen.findByText("Sin tema")).toBeOnTheScreen();
    expect(screen.getByText("1 tarjeta · Tema 2.pdf")).toBeOnTheScreen();
    expect(screen.getByText("Grafos")).toBeOnTheScreen();
    expect(screen.getByText("2 tarjetas · Tema 1.pdf")).toBeOnTheScreen();
    const titles = screen.getAllByTestId("study-title").map((title) => title.props.children);
    expect(titles).toEqual(["Sin tema", "Grafos"]);
    expect(mockApi.get).not.toHaveBeenCalledWith("/documents/d3/flashcard-decks");
  });

  it("lists the quizzes in their own section", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);
    expect(screen.getByRole("tab", { name: "Mazos" })).toBeSelected();

    await user.press(screen.getByRole("tab", { name: "Tests" }));

    expect(await screen.findByText("Repaso")).toBeOnTheScreen();
    expect(screen.getByText("1 pregunta · Tema 1.pdf")).toBeOnTheScreen();
    expect(screen.queryByText("Grafos")).toBeNull();
    expect(screen.getByRole("button", { name: "Crear test" })).toBeOnTheScreen();
  });

  it("opens a deck and a quiz", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);

    await user.press(await screen.findByText("Grafos"));
    expect(mockPush).toHaveBeenLastCalledWith("/projects/p1/decks/f1");

    await user.press(screen.getByRole("tab", { name: "Tests" }));
    await user.press(await screen.findByText("Repaso"));
    expect(mockPush).toHaveBeenLastCalledWith("/projects/p1/quizzes/q1");
  });

  it("says why a generation failed and does not open it", async () => {
    const failed = aDeck({
      id: "f4",
      topic: "Roto",
      status: "failed",
      error_message: "The document has no text.",
      cards: [],
    });
    serve({ ...server, "/documents/d1/flashcard-decks": [failed] });
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);

    expect(await screen.findByText("No se pudo generar")).toBeOnTheScreen();
    expect(screen.getByText("The document has no text.")).toBeOnTheScreen();
    await user.press(screen.getByText("Roto"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("says so when there is nothing yet", async () => {
    serve({ ...server, "/documents/d1/flashcard-decks": [], "/documents/d2/flashcard-decks": [] });
    await renderWithQueryClient(<StudySection projectId="p1" />);

    expect(await screen.findByText("Aún no hay flashcards")).toBeOnTheScreen();
    expect(screen.getByText("Créalas aquí o pídeselas al asistente en un chat.")).toBeOnTheScreen();
  });

  it("cannot create anything until a document is ready", async () => {
    serve({ "/projects/p1/documents": [processing] });
    await renderWithQueryClient(<StudySection projectId="p1" />);

    expect(await screen.findByText("Sube un PDF primero.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Crear flashcards" })).toBeDisabled();
  });

  it("creates a deck for the chosen document, topic and number", async () => {
    mockApi.post.mockResolvedValue(generating);
    await renderWithQueryClient(<StudySection projectId="p1" />);
    await screen.findByText("Grafos");
    const user = await openCreateForm();

    expect(screen.getByRole("radio", { name: "Tema 1.pdf" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Tema 3.pdf" })).toBeNull();
    await user.press(screen.getByRole("radio", { name: "Tema 2.pdf" }));
    await user.type(screen.getByLabelText("Tema (opcional)"), "  Árboles ");
    await user.clear(screen.getByLabelText("Número de tarjetas"));
    await user.type(screen.getByLabelText("Número de tarjetas"), "5");
    serve({ ...server, "/documents/d2/flashcard-decks": [generating, newer] });
    await user.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(screen.queryByLabelText("Número de tarjetas")).toBeNull());
    expect(mockApi.post).toHaveBeenCalledWith("/documents/d2/flashcard-decks", {
      count: 5,
      topic: "Árboles",
    });
    expect(await screen.findByText("Caminos")).toBeOnTheScreen();
    expect(screen.getByText("Generando…")).toBeOnTheScreen();
  });

  it("creates a quiz with ten questions and no topic by default", async () => {
    mockApi.post.mockResolvedValue(aQuiz({ id: "q2", status: "pending", questions: [] }));
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);
    await user.press(screen.getByRole("tab", { name: "Tests" }));
    await openCreateForm("Crear test");

    expect(screen.getByLabelText("Número de preguntas")).toHaveDisplayValue("10");
    await user.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith("/documents/d1/quizzes", {
        count: 10,
        topic: null,
      }),
    );
  });

  it.each(["0", "31", "2.5", ""])("rejects %j as the number of cards", async (count) => {
    await renderWithQueryClient(<StudySection projectId="p1" />);
    const user = await openCreateForm();

    await user.clear(screen.getByLabelText("Número de tarjetas"));
    if (count) await user.type(screen.getByLabelText("Número de tarjetas"), count);
    await user.press(screen.getByRole("button", { name: "Crear" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Elige un número entre 1 y 30.");
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("shows a failed creation in the form", async () => {
    mockApi.post.mockRejectedValue(new ApiError(409, "The document is not ready."));
    await renderWithQueryClient(<StudySection projectId="p1" />);
    const user = await openCreateForm();

    await user.press(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The document is not ready.");
    expect(screen.getByLabelText("Número de tarjetas")).toBeOnTheScreen();
  });

  it("shows a failed load with a way to retry", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("Network request failed"));
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);

    await user.press(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Grafos")).toBeOnTheScreen();
  });

  describe("while something is being generated", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("refreshes its list every 3 s until it is ready", async () => {
      serve({ ...server, "/documents/d1/flashcard-decks": [generating] });
      await renderWithQueryClient(<StudySection projectId="p1" />);
      expect(await screen.findByText("Generando…")).toBeOnTheScreen();
      const ready = { ...generating, status: "ready", cards: older.cards };
      serve({ ...server, "/documents/d1/flashcard-decks": [ready] });

      await act(() => jest.advanceTimersByTimeAsync(3000));

      expect(await screen.findByText("2 tarjetas · Tema 1.pdf")).toBeOnTheScreen();
      expect(screen.queryByText("Generando…")).toBeNull();
      const calls = () =>
        mockApi.get.mock.calls.filter(([path]) => path === "/documents/d1/flashcard-decks").length;
      const settled = calls();
      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(calls()).toBe(settled);
    });
  });
});

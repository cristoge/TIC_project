import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, Platform, type AlertButton } from "react-native";

import { aDocument } from "@/features/documents/testing/documents";
import { ApiError } from "@/shared/api";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { StudySection } from "./StudySection";
import { aDeck, aQuiz, listedDeck, listedQuiz } from "./testing/artifacts";

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

// Like the API, the per-document lists carry counts but not the cards or questions themselves.
function asListed(path: string, body: unknown) {
  if (!Array.isArray(body)) return body;
  if (path.endsWith("/flashcard-decks")) return body.map(listedDeck);
  if (path.endsWith("/quizzes")) return body.map(listedQuiz);
  return body;
}

function serve(server: Server) {
  mockApi.get.mockImplementation(async (path: string) => {
    if (!(path in server)) throw new Error(`Unexpected GET ${path}`);
    return asListed(path, server[path]);
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

    expect(await screen.findByText("Flashcards 1")).toBeOnTheScreen();
    expect(screen.getByText("1 tarjeta · Tema 2.pdf")).toBeOnTheScreen();
    expect(screen.getByText("Grafos")).toBeOnTheScreen();
    expect(screen.getByText("2 tarjetas · Tema 1.pdf")).toBeOnTheScreen();
    const titles = screen.getAllByTestId("study-title").map((title) => title.props.children);
    expect(titles).toEqual(["Flashcards 1", "Grafos"]);
    expect(mockApi.get).not.toHaveBeenCalledWith("/documents/d3/flashcard-decks");
  });

  it("numbers the ones without a name, oldest first", async () => {
    const first = aDeck({ id: "f5", topic: null, created_at: "2026-10-01T10:00:00Z" });
    serve({ ...server, "/documents/d1/flashcard-decks": [older, first] });
    await renderWithQueryClient(<StudySection projectId="p1" />);

    await screen.findByText("Grafos");
    const titles = screen.getAllByTestId("study-title").map((title) => title.props.children);
    expect(titles).toEqual(["Flashcards 2", "Grafos", "Flashcards 1"]);
  });

  it("numbers quizzes as tests", async () => {
    serve({ ...server, "/documents/d1/quizzes": [aQuiz({ id: "q1", topic: "  " })] });
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);

    await user.press(screen.getByRole("tab", { name: "Tests" }));

    expect(await screen.findByText("Test 1")).toBeOnTheScreen();
  });

  it("lists the quizzes in their own section", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<StudySection projectId="p1" />);
    expect(screen.getByRole("tab", { name: "Flashcards" })).toBeSelected();

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

  describe("renaming and deleting", () => {
    type Prompt = (text?: string) => void;

    beforeEach(() => {
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      jest.spyOn(Alert, "prompt").mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    /** Presses a button of the `index`-th alert shown (the last one by default). */
    async function pressAlertButton(text: string, index = -1) {
      const calls = jest.mocked(Alert.alert).mock.calls;
      const buttons = calls.at(index)?.[2] as AlertButton[];
      await act(async () => buttons.find((button) => button.text === text)?.onPress?.());
    }

    async function savePrompt(name: string) {
      const buttons = jest.mocked(Alert.prompt).mock.calls.at(-1)?.[2] as {
        text: string;
        onPress?: Prompt;
      }[];
      await act(async () => buttons.find((button) => button.text === "Guardar")?.onPress?.(name));
    }

    async function openOptions(title: string) {
      const user = userEvent.setup();
      await user.press(await screen.findByRole("button", { name: `Opciones de ${title}` }));
      return user;
    }

    it("opens its options as a menu in the middle of the screen", async () => {
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      const [title, message, buttons] = jest.mocked(Alert.alert).mock.calls[0];
      expect([title, message]).toEqual(["Grafos", undefined]);
      expect((buttons as AlertButton[]).map(({ text, style }) => [text, style])).toEqual([
        ["Renombrar", undefined],
        ["Eliminar", "destructive"],
        ["Cancelar", "cancel"],
      ]);
      expect(screen.queryByLabelText("Nombre")).toBeNull();
    });

    it("renames a deck from a prompt", async () => {
      mockApi.patch.mockResolvedValue({ ...older, topic: "Árboles" });
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Renombrar");
      expect(jest.mocked(Alert.prompt).mock.calls[0]).toEqual([
        "Renombrar",
        "Si lo dejas vacío, se numera.",
        expect.any(Array),
        "plain-text",
        "Grafos",
      ]);
      serve({ ...server, "/documents/d1/flashcard-decks": [{ ...older, topic: "Árboles" }] });
      await savePrompt("  Árboles ");

      expect(await screen.findByText("Árboles")).toBeOnTheScreen();
      expect(mockApi.patch).toHaveBeenCalledWith("/flashcard-decks/f1", { topic: "Árboles" });
    });

    it("clears a quiz's name so it is numbered again", async () => {
      mockApi.patch.mockResolvedValue({ ...quiz, topic: null });
      const user = userEvent.setup();
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await user.press(screen.getByRole("tab", { name: "Tests" }));
      await openOptions("Repaso");

      await pressAlertButton("Renombrar");
      serve({ ...server, "/documents/d1/quizzes": [{ ...quiz, topic: null }] });
      await savePrompt("   ");

      expect(await screen.findByText("Test 1")).toBeOnTheScreen();
      expect(mockApi.patch).toHaveBeenCalledWith("/quizzes/q1", { topic: null });
    });

    it("shows a failed rename", async () => {
      mockApi.patch.mockRejectedValue(new ApiError(409, "It is still being generated."));
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Renombrar");
      await savePrompt("Árboles");

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenLastCalledWith(
          "No se pudo renombrar",
          "It is still being generated.",
        ),
      );
    });

    it("renames from a form where there is no prompt (Android)", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      mockApi.patch.mockResolvedValue({ ...older, topic: "Árboles" });
      const user = userEvent.setup();
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Renombrar");
      expect(Alert.prompt).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Grafos");
      await user.clear(screen.getByLabelText("Nombre"));
      await user.type(screen.getByLabelText("Nombre"), "Árboles");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(mockApi.patch).toHaveBeenCalledWith("/flashcard-decks/f1", { topic: "Árboles" }),
      );
      await waitFor(() => expect(screen.queryByLabelText("Nombre")).toBeNull());
    });

    it("deletes a deck after confirming", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Eliminar");
      expect(jest.mocked(Alert.alert).mock.calls[1].slice(0, 2)).toEqual([
        "¿Eliminar estas flashcards?",
        "También desaparecerán del chat donde se crearon.",
      ]);
      expect(mockApi.delete).not.toHaveBeenCalled();
      serve({ ...server, "/documents/d1/flashcard-decks": [] });
      await pressAlertButton("Eliminar");

      await waitFor(() => expect(screen.queryByText("Grafos")).toBeNull());
      expect(mockApi.delete).toHaveBeenCalledWith("/flashcard-decks/f1");
    });

    it("deletes a quiz after confirming", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      const user = userEvent.setup();
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await user.press(screen.getByRole("tab", { name: "Tests" }));
      await openOptions("Repaso");

      await pressAlertButton("Eliminar");
      expect(jest.mocked(Alert.alert).mock.calls[1][0]).toBe("¿Eliminar este test?");
      await pressAlertButton("Eliminar");

      await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith("/quizzes/q1"));
    });

    it("keeps it when the deletion is cancelled", async () => {
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Eliminar");
      await pressAlertButton("Cancelar");

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it("shows a failed deletion", async () => {
      mockApi.delete.mockRejectedValue(new Error("Network request failed"));
      await renderWithQueryClient(<StudySection projectId="p1" />);
      await openOptions("Grafos");

      await pressAlertButton("Eliminar");
      await pressAlertButton("Eliminar");

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenLastCalledWith(
          "No se pudo eliminar",
          "Network request failed",
        ),
      );
    });

    it("opens the options of a failed one with a long press", async () => {
      const failed = aDeck({ id: "f4", topic: "Roto", status: "failed", cards: [] });
      serve({ ...server, "/documents/d1/flashcard-decks": [failed] });
      const user = userEvent.setup();
      await renderWithQueryClient(<StudySection projectId="p1" />);

      await user.longPress(await screen.findByText("Roto"));

      expect(jest.mocked(Alert.alert).mock.calls[0][0]).toBe("Roto");
    });

    it("offers no options while it is being generated", async () => {
      serve({ ...server, "/documents/d1/flashcard-decks": [generating] });
      await renderWithQueryClient(<StudySection projectId="p1" />);

      await screen.findByText("Caminos");
      expect(screen.queryByRole("button", { name: "Opciones de Caminos" })).toBeNull();
      expect(screen.getByRole("button", { name: "Opciones de Flashcards 1" })).toBeOnTheScreen();
    });
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
      const ready = { ...generating, status: "ready", card_count: 2 };
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

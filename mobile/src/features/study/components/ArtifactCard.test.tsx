import { act, screen, userEvent } from "@testing-library/react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { aDeck, aQuiz, aSummary } from "../testing/artifacts";
import { ArtifactCard } from "./ArtifactCard";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

beforeEach(() => {
  mockApi.get.mockReset();
});

describe("ArtifactCard", () => {
  it("shows a summary's overview and opens the rest on demand", async () => {
    mockApi.get.mockResolvedValue(aSummary());
    const user = userEvent.setup();
    await renderWithQueryClient(<ArtifactCard kind="summary" id="s1" />);

    expect(await screen.findByText("El tema presenta los grafos.")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/summaries/s1");
    expect(screen.getByText("Resumen")).toBeOnTheScreen();
    expect(screen.queryByText("Definiciones")).toBeNull();

    await user.press(screen.getByRole("button", { name: "Ver completo" }));

    expect(screen.getByText("Definiciones")).toBeOnTheScreen();
    expect(screen.getByText("• Nodo")).toBeOnTheScreen();
    expect(screen.getByText("Grado")).toBeOnTheScreen();
    expect(screen.getByText("Número de aristas de un nodo.")).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Ver menos" }));

    expect(screen.queryByText("Definiciones")).toBeNull();
  });

  it("shows a deck's topic and number of cards, and opens it", async () => {
    mockApi.get.mockResolvedValue(aDeck());
    const onOpen = jest.fn();
    const user = userEvent.setup();
    await renderWithQueryClient(<ArtifactCard kind="flashcards" id="f1" onOpen={onOpen} />);

    expect(await screen.findByText("Grafos · 2 tarjetas")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/flashcard-decks/f1");
    expect(screen.getByText("Flashcards")).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Estudiar" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows a quiz's number of questions, and opens it", async () => {
    mockApi.get.mockResolvedValue(aQuiz());
    const onOpen = jest.fn();
    const user = userEvent.setup();
    await renderWithQueryClient(<ArtifactCard kind="quiz" id="q1" onOpen={onOpen} />);

    expect(await screen.findByText("1 pregunta")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/quizzes/q1");
    expect(screen.getByText("Test")).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Hacer test" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("offers no action without a destination", async () => {
    mockApi.get.mockResolvedValue(aDeck());
    await renderWithQueryClient(<ArtifactCard kind="flashcards" id="f1" />);

    await screen.findByText("Grafos · 2 tarjetas");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a failed generation with its reason and no action", async () => {
    mockApi.get.mockResolvedValue(
      aQuiz({ status: "failed", error_message: "The document has no text.", questions: [] }),
    );
    await renderWithQueryClient(<ArtifactCard kind="quiz" id="q1" onOpen={jest.fn()} />);

    expect(await screen.findByText("No se pudo generar")).toBeOnTheScreen();
    expect(screen.getByText("The document has no text.")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a request that fails with a way to retry", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("Network request failed"));
    mockApi.get.mockResolvedValue(aSummary());
    const user = userEvent.setup();
    await renderWithQueryClient(<ArtifactCard kind="summary" id="s1" />);

    await user.press(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("El tema presenta los grafos.")).toBeOnTheScreen();
  });

  describe("while it is being generated", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("polls every 3 s until it is ready", async () => {
      mockApi.get
        .mockResolvedValueOnce(aDeck({ status: "pending", cards: [] }))
        .mockResolvedValue(aDeck());
      await renderWithQueryClient(<ArtifactCard kind="flashcards" id="f1" onOpen={jest.fn()} />);

      expect(await screen.findByText("Generando…")).toBeOnTheScreen();
      expect(screen.queryByRole("button")).toBeNull();

      await act(() => jest.advanceTimersByTimeAsync(2900));
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTimeAsync(100));

      expect(await screen.findByText("Grafos · 2 tarjetas")).toBeOnTheScreen();
      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });
});

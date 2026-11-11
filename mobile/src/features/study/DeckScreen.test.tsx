import { screen, userEvent } from "@testing-library/react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { DeckScreen } from "./DeckScreen";
import { aDeck } from "./testing/artifacts";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.get.mockResolvedValue(aDeck());
});

const card = (name: RegExp | string) => screen.getByRole("button", { name });

describe("DeckScreen", () => {
  it("shows the first card's question and its position", async () => {
    await renderWithQueryClient(<DeckScreen deckId="f1" />);

    expect(await screen.findByText("¿Qué es un nodo?")).toBeOnTheScreen();
    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
    expect(screen.queryByText("Un vértice.")).toBeNull();
    expect(mockApi.get).toHaveBeenCalledWith("/flashcard-decks/f1");
  });

  it("flips the card to its answer and page, and back", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<DeckScreen deckId="f1" />);
    await screen.findByText("¿Qué es un nodo?");

    await user.press(card(/¿Qué es un nodo\?/));

    expect(screen.getByText("Un vértice.")).toBeOnTheScreen();
    expect(screen.getByText("Página 1")).toBeOnTheScreen();
    expect(screen.queryByText("¿Qué es un nodo?")).toBeNull();

    await user.press(card(/Un vértice\./));

    expect(screen.getByText("¿Qué es un nodo?")).toBeOnTheScreen();
  });

  it("moves between cards, showing each one's question first", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<DeckScreen deckId="f1" />);
    await screen.findByText("¿Qué es un nodo?");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.press(card(/¿Qué es un nodo\?/));
    await user.press(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("¿Qué es una arista?")).toBeOnTheScreen();
    expect(screen.getByText("2 / 2")).toBeOnTheScreen();
    expect(screen.queryByText("Una unión.")).toBeNull();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    await user.press(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByText("¿Qué es un nodo?")).toBeOnTheScreen();
    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
  });

  it("says when the deck is still being generated", async () => {
    mockApi.get.mockResolvedValue(aDeck({ status: "pending", cards: [] }));
    await renderWithQueryClient(<DeckScreen deckId="f1" />);

    expect(await screen.findByText("Generando las flashcards…")).toBeOnTheScreen();
  });

  it("shows why the deck could not be generated", async () => {
    mockApi.get.mockResolvedValue(
      aDeck({ status: "failed", error_message: "The document has no text.", cards: [] }),
    );
    await renderWithQueryClient(<DeckScreen deckId="f1" />);

    expect(await screen.findByText("No se pudieron generar las flashcards")).toBeOnTheScreen();
    expect(screen.getByText("The document has no text.")).toBeOnTheScreen();
  });

  it("shows a failed load with a way to retry", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("Network request failed"));
    const user = userEvent.setup();
    await renderWithQueryClient(<DeckScreen deckId="f1" />);

    await user.press(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("¿Qué es un nodo?")).toBeOnTheScreen();
  });
});

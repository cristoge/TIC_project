import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { ChatScreen } from "./ChatScreen";
import { aConversation, aMessage, heldStream, streamOf } from "./testing/chat";

const mockApi = createFakeApi();
const mockStream = jest.fn();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("@/core/agent", () => ({
  getChatStream:
    () =>
    (...args: unknown[]) =>
      mockStream(...args),
}));

const tema1 = { n: 1, document_id: "d1", document_name: "Tema 1.pdf", page: 3 };
const history = [
  aMessage({ id: "m1", role: "user", content: "¿Qué es un grafo?" }),
  aMessage({ id: "m2", content: "Un **conjunto** de nodos [1].", sources: [tema1] }),
];

beforeEach(() => {
  for (const method of Object.values(mockApi)) method.mockReset();
  mockStream.mockReset();
  mockApi.get.mockResolvedValue(history);
});

async function ask(question: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Mensaje"), question);
  await user.press(screen.getByRole("button", { name: "Enviar" }));
  return user;
}

describe("ChatScreen", () => {
  it("shows the conversation's messages", async () => {
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    expect(await screen.findByText("¿Qué es un grafo?")).toBeOnTheScreen();
    expect(screen.getByText("conjunto")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/c1/messages");
  });

  it("shows the artifacts a message created", async () => {
    mockApi.get.mockImplementation(async (path: string) =>
      path === "/conversations/c1/messages"
        ? [aMessage({ id: "m2", content: "Aquí tienes el resumen.", summary_id: "s1" })]
        : { id: "s1", document_id: "d1", status: "pending", content: null, error_message: null },
    );
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    expect(await screen.findByText("Resumen")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/summaries/s1");
  });

  it("opens a citation with its document and page", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    await user.press(await screen.findByRole("button", { name: "Cita 1: Tema 1.pdf, página 3" }));

    expect(screen.getByText("Tema 1.pdf")).toBeOnTheScreen();
    expect(screen.getByText("Página 3")).toBeOnTheScreen();
  });

  it("does not send an empty message", async () => {
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    expect(await screen.findByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("streams the answer and keeps the turn once it ends", async () => {
    const { stream, release } = heldStream(
      [
        { type: "token", data: "Es una " },
        { type: "token", data: "**arista** [1]." },
        { type: "sources", data: [tema1] },
        { type: "artifact", kind: "flashcards", id: "f1" },
        { type: "end", message_id: "m4" },
      ],
      1,
    );
    mockStream.mockImplementation(stream);
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    await ask("¿Y una arista?");

    expect(await screen.findByText("Es una")).toBeOnTheScreen();
    expect(screen.getByText("¿Y una arista?")).toBeOnTheScreen();
    expect(screen.getByLabelText("Mensaje")).toHaveDisplayValue("");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "c1", message: "¿Y una arista?" }),
    );

    mockApi.get.mockImplementation(async (path: string) =>
      path === "/conversations/c1/messages"
        ? [
            ...history,
            aMessage({ id: "m3", role: "user", content: "¿Y una arista?" }),
            aMessage({
              id: "m4",
              content: "Es una **arista** [1].",
              sources: [tema1],
              flashcard_deck_id: "f1",
            }),
          ]
        : { id: "f1", status: "pending", topic: null, error_message: null, cards: [] },
    );
    await act(async () => release());

    expect(await screen.findByText("arista")).toBeOnTheScreen();
    expect(await screen.findByText("Flashcards")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: /^Cita 1/ })).toHaveLength(2);
    expect(screen.getAllByText("¿Y una arista?")).toHaveLength(1);
    expect(screen.getByText("¿Qué es un grafo?")).toBeOnTheScreen();
  });

  it("creates the conversation, titled after the first message, before the first turn", async () => {
    mockApi.post.mockResolvedValue(aConversation({ id: "c9", title: "¿Qué es un grafo?" }));
    // What the server holds once the turn has ended.
    mockApi.get.mockResolvedValue([
      aMessage({ id: "m1", role: "user", content: "¿Qué es un grafo?" }),
      aMessage({ id: "m2", content: "Un conjunto." }),
    ]);
    mockStream.mockImplementation(
      streamOf({ type: "token", data: "Un conjunto." }, { type: "end", message_id: "m2" }),
    );
    const onCreated = jest.fn();
    await renderWithQueryClient(
      <ChatScreen projectId="p1" conversationId={null} onCreated={onCreated} />,
    );

    expect(screen.getByText("Pregunta sobre tus documentos")).toBeOnTheScreen();
    await ask("¿Qué es un grafo?");

    expect(await screen.findByText("Un conjunto.")).toBeOnTheScreen();
    expect(mockApi.post).toHaveBeenCalledWith("/projects/p1/conversations", {
      title: "¿Qué es un grafo?",
    });
    expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "c9" }));
    expect(onCreated).toHaveBeenCalledWith("c9");
    expect(screen.queryByText("Pregunta sobre tus documentos")).toBeNull();
  });

  it("shortens a long first message for the conversation's title", async () => {
    mockApi.post.mockResolvedValue(aConversation({ id: "c9" }));
    mockStream.mockImplementation(streamOf({ type: "end", message_id: "m2" }));
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId={null} />);

    await ask("a".repeat(90));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalled());
    expect(mockApi.post.mock.calls[0][1]).toEqual({ title: `${"a".repeat(59)}…` });
  });

  it("shows the agent's error and repeats the question on retry", async () => {
    mockStream.mockImplementationOnce(
      streamOf({ type: "error", code: "no_answer", message: "No answer could be produced." }),
    );
    mockStream.mockImplementationOnce(
      streamOf({ type: "token", data: "Ahora sí." }, { type: "end", message_id: "m4" }),
    );
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    const user = await ask("¿Y una arista?");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No he podido responder. Inténtalo de nuevo.",
    );
    expect(screen.getByText("¿Y una arista?")).toBeOnTheScreen();
    mockApi.get.mockResolvedValue([
      ...history,
      aMessage({ id: "m3", role: "user", content: "¿Y una arista?" }),
      aMessage({ id: "m4", content: "Ahora sí." }),
    ]);

    await user.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Ahora sí.")).toBeOnTheScreen();
    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(mockStream.mock.calls[1][0]).toMatchObject({ message: "¿Y una arista?" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a connection error when the agent cannot be reached", async () => {
    mockStream.mockImplementation(streamOf(new Error("Network request failed")));
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    await ask("¿Y una arista?");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el asistente.",
    );
  });

  it("treats an answer that stops without ending as interrupted", async () => {
    mockStream.mockImplementation(streamOf({ type: "token", data: "Es una" }));
    await renderWithQueryClient(<ChatScreen projectId="p1" conversationId="c1" />);

    await ask("¿Y una arista?");

    expect(await screen.findByRole("alert")).toHaveTextContent("La respuesta se interrumpió.");
  });

  it("stops reading the answer when the screen closes", async () => {
    const { stream } = heldStream(
      [
        { type: "token", data: "Es" },
        { type: "end", message_id: "m4" },
      ],
      1,
    );
    mockStream.mockImplementation(stream);
    const { unmount } = await renderWithQueryClient(
      <ChatScreen projectId="p1" conversationId="c1" />,
    );
    await ask("¿Y una arista?");
    await screen.findByText("Es");
    const { signal } = mockStream.mock.calls[0][0] as { signal: AbortSignal };

    await unmount();

    expect(signal.aborted).toBe(true);
  });
});

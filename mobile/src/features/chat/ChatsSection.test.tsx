import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { ChatsSection } from "./ChatsSection";
import { aConversation } from "./testing/chat";

const mockApi = createFakeApi();
const mockPush = jest.fn();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const graphs = aConversation({ id: "c1", title: "¿Qué es un grafo?" });
const untitled = aConversation({ id: "c2", updated_at: "2026-11-05T12:00:00Z" });

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  for (const method of Object.values(mockApi)) method.mockReset();
  mockApi.get.mockResolvedValue([graphs, untitled]);
});

function pressAlertButton(text: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
}

describe("ChatsSection", () => {
  it("lists the project's chats with their title and date", async () => {
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    expect(await screen.findByText("¿Qué es un grafo?")).toBeOnTheScreen();
    expect(screen.getByText("Chat sin título")).toBeOnTheScreen();
    expect(screen.getByText("1 nov")).toBeOnTheScreen();
    expect(screen.getByText("5 nov")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/projects/p1/conversations");
  });

  it("says so when there are no chats yet", async () => {
    mockApi.get.mockResolvedValue([]);
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    expect(await screen.findByText("Aún no hay chats")).toBeOnTheScreen();
  });

  it("opens a chat", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await user.press(await screen.findByText("¿Qué es un grafo?"));

    expect(mockPush).toHaveBeenCalledWith("/projects/p1/chats/c1");
  });

  it("starts a new chat without creating it yet", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await user.press(screen.getByRole("button", { name: "Nuevo chat" }));

    expect(mockPush).toHaveBeenCalledWith("/projects/p1/chats/new");
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("deletes a chat after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockApi.delete.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await user.press(await screen.findByRole("button", { name: "Eliminar ¿Qué es un grafo?" }));

    expect(Alert.alert).toHaveBeenCalledWith(
      "¿Eliminar chat?",
      "Se borrarán sus mensajes.",
      expect.any(Array),
      expect.anything(),
    );
    expect(mockApi.delete).not.toHaveBeenCalled();

    mockApi.get.mockResolvedValue([untitled]);
    pressAlertButton("Eliminar");

    await waitFor(() => expect(screen.queryByText("¿Qué es un grafo?")).toBeNull());
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/c1");
  });

  it("keeps the chat when the deletion is cancelled", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await user.press(await screen.findByRole("button", { name: "Eliminar Chat sin título" }));
    pressAlertButton("Cancelar");

    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  it("shows a failed deletion", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockApi.delete.mockRejectedValue(new Error("Network request failed"));
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await user.press(await screen.findByRole("button", { name: "Eliminar ¿Qué es un grafo?" }));
    pressAlertButton("Eliminar");

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        "No se pudo eliminar el chat",
        "Network request failed",
      ),
    );
  });

  it("shows a failed load with a way to retry", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("Network request failed"));
    const user = userEvent.setup();
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    expect(await screen.findByText("Network request failed")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("¿Qué es un grafo?")).toBeOnTheScreen();
  });
});

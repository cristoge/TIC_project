import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, Platform, type AlertButton } from "react-native";

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

/** Presses a button of the last centred alert, as the user would. */
async function pressAlertButton(text: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === text)?.onPress?.());
}

async function savePrompt(name: string) {
  const buttons = jest.mocked(Alert.prompt).mock.calls.at(-1)?.[2] as {
    text: string;
    onPress?: (text?: string) => void;
  }[];
  await act(async () => buttons.find((button) => button.text === "Guardar")?.onPress?.(name));
}

async function openOptions(title: string) {
  const user = userEvent.setup();
  await user.press(await screen.findByRole("button", { name: `Opciones de ${title}` }));
  return user;
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

  it("opens a chat's options as a centred menu", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await openOptions("¿Qué es un grafo?");

    expect(alert).toHaveBeenCalledWith("¿Qué es un grafo?", undefined, expect.any(Array), {
      cancelable: true,
    });
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    expect(buttons.map(({ text, style }) => [text, style])).toEqual([
      ["Renombrar", undefined],
      ["Eliminar", "destructive"],
      ["Cancelar", "cancel"],
    ]);
  });

  describe("rename", () => {
    beforeEach(() => {
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      jest.spyOn(Alert, "prompt").mockImplementation(() => {});
    });

    it("renames a chat from a prompt and refreshes the list", async () => {
      mockApi.patch.mockResolvedValue({ ...graphs, title: "Grafos" });
      await renderWithQueryClient(<ChatsSection projectId="p1" />);
      await openOptions("¿Qué es un grafo?");

      await pressAlertButton("Renombrar");
      expect(jest.mocked(Alert.prompt).mock.calls[0]).toEqual([
        "Renombrar chat",
        undefined,
        expect.any(Array),
        "plain-text",
        "¿Qué es un grafo?",
      ]);
      mockApi.get.mockResolvedValue([{ ...graphs, title: "Grafos" }, untitled]);
      await savePrompt("  Grafos ");

      expect(await screen.findByText("Grafos")).toBeOnTheScreen();
      expect(mockApi.patch).toHaveBeenCalledWith("/conversations/c1", { title: "Grafos" });
    });

    it("starts an untitled chat's prompt empty", async () => {
      await renderWithQueryClient(<ChatsSection projectId="p1" />);
      await openOptions("Chat sin título");

      await pressAlertButton("Renombrar");

      expect(jest.mocked(Alert.prompt).mock.calls[0][4]).toBe("");
    });

    it("asks for a name instead of saving a blank one", async () => {
      await renderWithQueryClient(<ChatsSection projectId="p1" />);
      await openOptions("¿Qué es un grafo?");
      await pressAlertButton("Renombrar");

      await savePrompt("   ");

      expect(Alert.alert).toHaveBeenLastCalledWith("Escribe un nombre.");
      expect(mockApi.patch).not.toHaveBeenCalled();
    });

    it("shows a failed rename", async () => {
      mockApi.patch.mockRejectedValue(new Error("Network request failed"));
      await renderWithQueryClient(<ChatsSection projectId="p1" />);
      await openOptions("¿Qué es un grafo?");
      await pressAlertButton("Renombrar");

      await savePrompt("Grafos");

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenLastCalledWith(
          "No se pudo renombrar el chat",
          "Network request failed",
        ),
      );
    });

    it("renames from a form where there is no prompt (Android)", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      mockApi.patch.mockResolvedValue({ ...graphs, title: "Grafos" });
      await renderWithQueryClient(<ChatsSection projectId="p1" />);
      const user = await openOptions("¿Qué es un grafo?");

      await pressAlertButton("Renombrar");
      expect(Alert.prompt).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("¿Qué es un grafo?");
      await user.clear(screen.getByLabelText("Nombre"));
      await user.type(screen.getByLabelText("Nombre"), "Grafos");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(mockApi.patch).toHaveBeenCalledWith("/conversations/c1", { title: "Grafos" }),
      );
      await waitFor(() => expect(screen.queryByLabelText("Nombre")).toBeNull());
    });
  });

  it("deletes a chat after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockApi.delete.mockResolvedValue(undefined);
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await openOptions("¿Qué es un grafo?");
    await pressAlertButton("Eliminar");

    expect(Alert.alert).toHaveBeenCalledWith(
      "¿Eliminar chat?",
      "Se borrarán sus mensajes.",
      expect.any(Array),
      expect.anything(),
    );
    expect(mockApi.delete).not.toHaveBeenCalled();

    mockApi.get.mockResolvedValue([untitled]);
    await pressAlertButton("Eliminar");

    await waitFor(() => expect(screen.queryByText("¿Qué es un grafo?")).toBeNull());
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/c1");
  });

  it("keeps the chat when the deletion is cancelled", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await openOptions("Chat sin título");
    await pressAlertButton("Eliminar");
    await pressAlertButton("Cancelar");

    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  it("shows a failed deletion", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockApi.delete.mockRejectedValue(new Error("Network request failed"));
    await renderWithQueryClient(<ChatsSection projectId="p1" />);

    await openOptions("¿Qué es un grafo?");
    await pressAlertButton("Eliminar");
    await pressAlertButton("Eliminar");

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

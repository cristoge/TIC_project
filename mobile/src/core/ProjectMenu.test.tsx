import { screen, userEvent } from "@testing-library/react-native";

import { aConversation } from "@/features/chat/testing/chat";
import { aProject } from "@/features/projects/testing/projects";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { ProjectMenu } from "./ProjectMenu";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

const conversations = Array.from({ length: 10 }, (_, index) =>
  aConversation({ id: `c${index}`, title: index === 1 ? null : `Chat ${index}` }),
);

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === "/projects") return [aProject({ id: "p1", name: "Biología" })];
    if (path === "/projects/p1/conversations") return conversations;
    if (path === "/me") return { id: "u1", email: "ana@example.com", name: "Ana" };
    throw new Error(`Unexpected GET ${path}`);
  });
});

async function renderMenu(active: Parameters<typeof ProjectMenu>[0]["active"] = "chats") {
  const onNavigate = jest.fn();
  await renderWithQueryClient(
    <ProjectMenu projectId="p1" active={active} onNavigate={onNavigate} />,
  );
  await screen.findByText("Biología");
  return { onNavigate, user: userEvent.setup() };
}

describe("ProjectMenu", () => {
  it("starts a new chat in the project", async () => {
    const { onNavigate, user } = await renderMenu();

    await user.press(screen.getByRole("button", { name: "Nuevo chat" }));

    expect(onNavigate).toHaveBeenCalledWith("/projects/p1/chats/new");
  });

  it("switches project from the project's name", async () => {
    const { onNavigate, user } = await renderMenu();

    await user.press(screen.getByRole("button", { name: "Cambiar de proyecto: Biología" }));

    expect(onNavigate).toHaveBeenCalledWith("/projects");
  });

  it("opens the project's chats, documents and study sections, marking the current one", async () => {
    const { onNavigate, user } = await renderMenu("documents");

    expect(screen.getByRole("button", { name: "Documentos" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Chats" })).not.toBeSelected();

    await user.press(screen.getByRole("button", { name: "Chats" }));
    await user.press(screen.getByRole("button", { name: "Documentos" }));
    await user.press(screen.getByRole("button", { name: "Estudio" }));

    expect(onNavigate.mock.calls).toEqual([
      ["/projects/p1/chats"],
      ["/projects/p1/documents"],
      ["/projects/p1/study"],
    ]);
  });

  it("lists the eight most recent chats and opens one", async () => {
    const { onNavigate, user } = await renderMenu({ conversationId: "c2" });

    expect(await screen.findByText("Chat 0")).toBeOnTheScreen();
    expect(screen.getByText("Chat sin título")).toBeOnTheScreen();
    expect(screen.getByText("Chat 7")).toBeOnTheScreen();
    expect(screen.queryByText("Chat 8")).toBeNull();
    expect(screen.getByRole("button", { name: "Chat 2" })).toBeSelected();

    await user.press(screen.getByRole("button", { name: "Chat 3" }));

    expect(onNavigate).toHaveBeenCalledWith("/projects/p1/chats/c3");
  });

  it("shows who is signed in and opens the settings from there", async () => {
    const { onNavigate, user } = await renderMenu();

    expect(await screen.findByText("Ana")).toBeOnTheScreen();
    expect(screen.getByText("ana@example.com")).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Ajustes: Ana" }));

    expect(onNavigate).toHaveBeenCalledWith("/settings");
  });
});

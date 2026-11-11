import { screen, userEvent } from "@testing-library/react-native";

import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { ProjectScreen } from "./ProjectScreen";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.get.mockResolvedValue([]);
});

describe("ProjectScreen", () => {
  it("opens on the project's documents", async () => {
    await renderWithQueryClient(<ProjectScreen projectId="p1" />);

    expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual([
      "Chats",
      "Documentos",
      "Estudio",
    ]);
    expect(screen.getByRole("tab", { name: "Documentos" })).toBeSelected();
    expect(await screen.findByText("Aún no hay documentos")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/projects/p1/documents");
  });

  it("switches between the sections", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<ProjectScreen projectId="p1" />);
    await screen.findByText("Aún no hay documentos");

    await user.press(screen.getByRole("tab", { name: "Chats" }));
    expect(await screen.findByText("Aún no hay chats")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/projects/p1/conversations");
    expect(screen.getByRole("tab", { name: "Chats" })).toBeSelected();
    expect(screen.queryByText("Aún no hay documentos")).not.toBeOnTheScreen();

    await user.press(screen.getByRole("tab", { name: "Estudio" }));
    expect(await screen.findByText("Aún no hay flashcards")).toBeOnTheScreen();
    expect(screen.queryByText("Aún no hay chats")).not.toBeOnTheScreen();

    await user.press(screen.getByRole("tab", { name: "Documentos" }));
    expect(await screen.findByText("Aún no hay documentos")).toBeOnTheScreen();
  });
});

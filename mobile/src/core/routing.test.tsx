import { screen, userEvent } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { useSession } from "@/features/auth";
import { useLastProject } from "@/features/projects";
import { items } from "@/features/auth/testing/memorySecureStore";
import { createFakeApi } from "@/shared/testing/query";

const mockApi = createFakeApi();

jest.mock("expo-secure-store", () =>
  jest.requireActual("@/features/auth/testing/memorySecureStore"),
);

// The home screen lists projects: answer with none instead of reaching the network.
jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

// The real routes in src/app, with the real root layout and its session guards.
const appDirectory = "./src/app";

beforeEach(() => {
  items.clear();
  // The app's session is a module singleton: start every test as a fresh launch.
  useSession.setState({ status: "restoring", idToken: null });
  useLastProject.setState({ projectId: null, restored: false });
  mockApi.get.mockReset();
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === "/projects")
      return [{ id: "p1", name: "Biología", description: null, created_at: "", updated_at: "" }];
    if (path === "/me") return { id: "u1", email: "ana@example.com", name: "Ana" };
    return [];
  });
});

function storeSession() {
  items.set("auth.idToken", "id-1");
  items.set("auth.refreshToken", "refresh-1");
}

describe("session-guarded routes", () => {
  it("sends a signed-out user opening the app to the login screen", async () => {
    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByLabelText("Email")).toBeOnTheScreen();
    expect(screen).toHavePathname("/login");
  });

  it("opens the projects list for a stored session with no project opened yet", async () => {
    storeSession();

    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/projects");
  });

  it("keeps a signed-in user away from the login screen", async () => {
    storeSession();

    await renderRouter(appDirectory, { initialUrl: "/login" });

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/projects");
  });
});

describe("start screen", () => {
  it("opens a new chat in the last project used", async () => {
    storeSession();
    items.set("app.lastProjectId", "p1");

    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByText("Pregunta sobre tus documentos")).toBeOnTheScreen();
    expect(screen).toHavePathname("/projects/p1/chats/new");
  });

  it("opens the projects list when the last project no longer exists", async () => {
    storeSession();
    items.set("app.lastProjectId", "deleted");

    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/projects");
  });

  it("remembers a project once it is opened", async () => {
    storeSession();

    await renderRouter(appDirectory, { initialUrl: "/projects/p1/documents" });

    expect(await screen.findByRole("button", { name: "Subir PDF" })).toBeOnTheScreen();
    expect(items.get("app.lastProjectId")).toBe("p1");
  });
});

describe("project menu", () => {
  it("opens from the header and moves between sections", async () => {
    storeSession();
    const user = userEvent.setup();
    await renderRouter(appDirectory, { initialUrl: "/projects/p1/chats" });
    await screen.findByText("Aún no hay chats");

    await user.press(screen.getByRole("button", { name: "Abrir menú" }));
    expect(await screen.findByRole("button", { name: "Chats" })).toBeSelected();
    await user.press(screen.getByRole("button", { name: "Documentos" }));

    expect(await screen.findByRole("button", { name: "Subir PDF" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/projects/p1/documents");
  });

  it("starts a new chat from the header of a chat", async () => {
    storeSession();
    mockApi.get.mockImplementation(async (path: string) => {
      if (path === "/conversations/c1/messages") {
        return [
          {
            id: "m1",
            role: "user",
            content: "¿Qué es un grafo?",
            created_at: "",
            summary_id: null,
            flashcard_deck_id: null,
            quiz_id: null,
            sources: [],
          },
        ];
      }
      return [];
    });
    const user = userEvent.setup();
    await renderRouter(appDirectory, { initialUrl: "/projects/p1/chats/c1" });
    await screen.findByText("¿Qué es un grafo?");

    await user.press(screen.getByRole("button", { name: "Nuevo chat" }));

    expect(await screen.findByText("Pregunta sobre tus documentos")).toBeOnTheScreen();
    expect(screen.queryByText("¿Qué es un grafo?")).toBeNull();
    expect(screen).toHavePathname("/projects/p1/chats/new");
  });
});

describe("project menu routes", () => {
  it.each([
    ["/projects/p1", "/projects/p1/chats/new", "Pregunta sobre tus documentos"],
    ["/projects/p1/chats", "/projects/p1/chats", "Aún no hay chats"],
    ["/projects/p1/study", "/projects/p1/study", "Aún no hay flashcards"],
  ])("%s shows its section", async (url, pathname, text) => {
    storeSession();

    await renderRouter(appDirectory, { initialUrl: url });

    expect(await screen.findByText(text)).toBeOnTheScreen();
    expect(screen).toHavePathname(pathname);
  });
});

describe("settings", () => {
  it("is a signed-in route", async () => {
    storeSession();

    await renderRouter(appDirectory, { initialUrl: "/settings" });

    expect(await screen.findByText("ana@example.com")).toBeOnTheScreen();
    expect(screen).toHavePathname("/settings");
  });

  it("is out of reach once signed out", async () => {
    await renderRouter(appDirectory, { initialUrl: "/settings" });

    expect(await screen.findByLabelText("Email")).toBeOnTheScreen();
    expect(screen).toHavePathname("/login");
  });
});

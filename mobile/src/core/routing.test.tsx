import { screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { useSession } from "@/features/auth";
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
  mockApi.get.mockReset();
  mockApi.get.mockResolvedValue([]);
});

describe("session-guarded routes", () => {
  it("sends a signed-out user opening the app to the login screen", async () => {
    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByLabelText("Email")).toBeOnTheScreen();
    expect(screen).toHavePathname("/login");
  });

  it("opens the home screen for a stored session", async () => {
    items.set("auth.idToken", "id-1");
    items.set("auth.refreshToken", "refresh-1");

    await renderRouter(appDirectory, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });

  it("keeps a signed-in user away from the login screen", async () => {
    items.set("auth.idToken", "id-1");
    items.set("auth.refreshToken", "refresh-1");

    await renderRouter(appDirectory, { initialUrl: "/login" });

    expect(await screen.findByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });
});

describe("settings", () => {
  it("is a signed-in route", async () => {
    items.set("auth.idToken", "id-1");
    items.set("auth.refreshToken", "refresh-1");
    mockApi.get.mockImplementation(async (path: string) =>
      path === "/me" ? { id: "u1", email: "ana@example.com", name: "Ana" } : [],
    );

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

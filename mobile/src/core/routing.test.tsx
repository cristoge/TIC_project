import { screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { useSession } from "@/features/auth";
import { items } from "@/features/auth/testing/memorySecureStore";

jest.mock("expo-secure-store", () =>
  jest.requireActual("@/features/auth/testing/memorySecureStore"),
);

// The real routes in src/app, with the real root layout and its session guards.
const appDirectory = "./src/app";

beforeEach(() => {
  items.clear();
  // The app's session is a module singleton: start every test as a fresh launch.
  useSession.setState({ status: "restoring", idToken: null });
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

    expect(await screen.findByText("Aquí irá la lista de proyectos.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });

  it("keeps a signed-in user away from the login screen", async () => {
    items.set("auth.idToken", "id-1");
    items.set("auth.refreshToken", "refresh-1");

    await renderRouter(appDirectory, { initialUrl: "/login" });

    expect(await screen.findByText("Aquí irá la lista de proyectos.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });
});

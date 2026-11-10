import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { LoginScreen } from "./LoginScreen";
import { useSession } from "./session";
import { fakeFetch, signInResult, type FakeResponse } from "./testing/fakeFetch";
import { items } from "./testing/memorySecureStore";

jest.mock("expo-secure-store", () => jest.requireActual("./testing/memorySecureStore"));
jest.mock("@/shared/config/env", () => ({
  getEnv: () => ({
    apiUrl: "http://api",
    agentUrl: "http://agent",
    cognitoRegion: "eu-south-2",
    cognitoClientId: "client-1",
  }),
}));

const realFetch = globalThis.fetch;

function stubFetch(...responses: FakeResponse[]) {
  const fetch = fakeFetch(...responses);
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  return fetch;
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Contraseña"), password);
  await user.press(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

beforeEach(async () => {
  await useSession.getState().signOut();
  items.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("LoginScreen", () => {
  it("asks for the email before calling Cognito", async () => {
    const fetch = stubFetch();
    await render(<LoginScreen />);

    await fillAndSubmit("   ", "pass");

    expect(screen.getByText("Escribe tu email.")).toBeOnTheScreen();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks for the password before calling Cognito", async () => {
    const fetch = stubFetch();
    await render(<LoginScreen />);

    await fillAndSubmit("ana@example.com", "");

    expect(screen.getByText("Escribe tu contraseña.")).toBeOnTheScreen();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs in with the trimmed email", async () => {
    const fetch = stubFetch(signInResult("id-1", "refresh-1"));
    await render(<LoginScreen />);

    await fillAndSubmit("  ana@example.com ", "pass");

    await waitFor(() => expect(useSession.getState().status).toBe("signedIn"));
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.AuthParameters).toEqual({ USERNAME: "ana@example.com", PASSWORD: "pass" });
    expect(items.get("auth.idToken")).toBe("id-1");
  });

  it("shows the sign-in error", async () => {
    stubFetch({ status: 400, body: { __type: "NotAuthorizedException" } });
    await render(<LoginScreen />);

    await fillAndSubmit("ana@example.com", "wrong");

    expect(await screen.findByText("Email o contraseña incorrectos.")).toBeOnTheScreen();
    expect(useSession.getState().status).toBe("signedOut");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("ignores a second submit while signing in", async () => {
    let answer: (response: Response) => void = () => {};
    const fetch = jest.fn(
      (_url: string, _init: RequestInit) => new Promise<Response>((resolve) => (answer = resolve)),
    );
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    await render(<LoginScreen />);

    const user = await fillAndSubmit("ana@example.com", "pass");
    const button = screen.getByRole("button", { name: "Entrar" });
    await user.press(button);

    expect(button).toBeBusy();
    expect(fetch).toHaveBeenCalledTimes(1);

    const { body } = signInResult("id-1", "refresh-1");
    answer({ ok: true, status: 200, text: async () => JSON.stringify(body) } as Response);
    await waitFor(() => expect(useSession.getState().status).toBe("signedIn"));
  });
});

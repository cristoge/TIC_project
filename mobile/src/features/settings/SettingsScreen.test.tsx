import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, Appearance, type AlertButton } from "react-native";

import { useSession } from "@/features/auth";
import { ApiError } from "@/shared/api";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";
import { useThemePreference } from "@/shared/theme";

import { SettingsScreen } from "./SettingsScreen";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-secure-store", () =>
  jest.requireActual("@/features/auth/testing/memorySecureStore"),
);

const me = { id: "u1", email: "ana@example.com", name: "Ana" };
const signOut = jest.fn(async () => {});

beforeEach(() => {
  jest.restoreAllMocks();
  for (const method of Object.values(mockApi)) method.mockReset();
  mockApi.get.mockResolvedValue(me);
  signOut.mockClear();
  useSession.setState({ status: "signedIn", idToken: "id-1", signOut });
  useThemePreference.setState({ preference: "system", accent: "blue" });
  jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
});

function pressAlertButton(text: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
}

describe("SettingsScreen", () => {
  it("shows the account's email and name", async () => {
    await renderWithQueryClient(<SettingsScreen />);

    expect(await screen.findByText("ana@example.com")).toBeOnTheScreen();
    expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Ana");
    expect(mockApi.get).toHaveBeenCalledWith("/me");
  });

  it("saves a new name", async () => {
    mockApi.patch.mockResolvedValue({ ...me, name: "Ana María" });
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);
    await screen.findByText("ana@example.com");

    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "  Ana María ");
    mockApi.get.mockResolvedValue({ ...me, name: "Ana María" });
    await user.press(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(await screen.findByText("Nombre guardado.")).toBeOnTheScreen();
    expect(mockApi.patch).toHaveBeenCalledWith("/me", { name: "Ana María" });
  });

  it("asks for a name instead of saving an empty one", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);
    await screen.findByText("ana@example.com");

    await user.clear(screen.getByLabelText("Nombre"));
    await user.press(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un nombre.");
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it("starts empty for an account without a name", async () => {
    mockApi.get.mockResolvedValue({ ...me, name: null });
    await renderWithQueryClient(<SettingsScreen />);

    await screen.findByText("ana@example.com");
    expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("");
  });

  it("shows a failed save", async () => {
    mockApi.patch.mockRejectedValue(new ApiError(500, "Request failed (500)."));
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);
    await screen.findByText("ana@example.com");

    await user.press(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed (500).");
  });

  it("switches the colour scheme", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);
    expect(screen.getByRole("tab", { name: "Sistema" })).toBeSelected();

    await user.press(screen.getByRole("tab", { name: "Oscuro" }));

    expect(useThemePreference.getState().preference).toBe("dark");
    expect(screen.getByRole("tab", { name: "Oscuro" })).toBeSelected();
  });

  it("changes the accent colour, blue by default", async () => {
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);
    const options = screen.getAllByRole("radio");
    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      "Azul",
      "Violeta",
      "Verde",
      "Naranja",
      "Rosa",
    ]);
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();

    await user.press(screen.getByRole("radio", { name: "Verde" }));

    expect(useThemePreference.getState().accent).toBe("green");
    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Azul" })).not.toBeChecked();
  });

  it("signs out after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);

    await user.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(Alert.alert).toHaveBeenCalledWith(
      "¿Cerrar sesión?",
      "Tendrás que volver a entrar con tu email y contraseña.",
      expect.any(Array),
      expect.anything(),
    );
    expect(signOut).not.toHaveBeenCalled();
    pressAlertButton("Cerrar sesión");

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("stays signed in when cancelled", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);

    await user.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    pressAlertButton("Cancelar");

    expect(signOut).not.toHaveBeenCalled();
  });

  it("can sign out even when the profile does not load", async () => {
    mockApi.get.mockRejectedValue(new Error("Network request failed"));
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithQueryClient(<SettingsScreen />);

    expect(await screen.findByText("Network request failed")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    pressAlertButton("Cerrar sesión");

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});

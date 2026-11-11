import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { ApiError } from "@/shared/api";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";

import { useLastProject } from "./lastProject";
import { ProjectsScreen } from "./ProjectsScreen";
import { aProject } from "./testing/projects";

const mockApi = createFakeApi();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
let mockCanDismiss = false;

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    dismissAll: mockDismissAll,
    canDismiss: () => mockCanDismiss,
  }),
}));

const biology = aProject({ id: "p1", name: "Biología", description: "Apuntes del tema 3" });
const history = aProject({ id: "p2", name: "Historia", updated_at: "2026-11-05T09:00:00Z" });

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockApi.patch.mockReset();
  mockApi.delete.mockReset();
});

async function openCreateForm() {
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "Nuevo proyecto" }));
  return user;
}

// Presses a button of the last centred alert, as the user would.
async function pressAlertButton(text: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === text)?.onPress?.());
}

async function openRenameForm(name: string) {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const user = userEvent.setup();
  await user.longPress(await screen.findByText(name));
  await pressAlertButton("Renombrar");
  return user;
}

describe("ProjectsScreen", () => {
  it("lists the projects with their descriptions", async () => {
    mockApi.get.mockResolvedValue([biology, history]);

    await renderWithQueryClient(<ProjectsScreen />);

    expect(await screen.findByText("Biología")).toBeOnTheScreen();
    expect(screen.getByText("Apuntes del tema 3")).toBeOnTheScreen();
    expect(screen.getByText("Historia")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/projects");
  });

  it("heads the list with its title, how many there are and a compact add button", async () => {
    mockApi.get.mockResolvedValue([biology, history]);

    await renderWithQueryClient(<ProjectsScreen />);

    expect(await screen.findByText("2 proyectos")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Proyectos" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Nuevo proyecto" })).toBeOnTheScreen();
  });

  it("shows when each project was last changed and marks the current one", async () => {
    mockApi.get.mockResolvedValue([biology, history]);
    useLastProject.setState({ projectId: "p2", restored: true });

    await renderWithQueryClient(<ProjectsScreen />);

    expect(await screen.findByText("Actualizado el 1 nov")).toBeOnTheScreen();
    expect(screen.getByText("Actualizado el 5 nov")).toBeOnTheScreen();
    expect(screen.getAllByText("Actual")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Historia, proyecto actual" })).toBeOnTheScreen();
    useLastProject.setState({ projectId: null, restored: false });
  });

  it("shows the empty state, with a way to create the first project", async () => {
    mockApi.get.mockResolvedValue([]);
    const user = userEvent.setup();

    await renderWithQueryClient(<ProjectsScreen />);

    expect(await screen.findByText("Aún no tienes proyectos")).toBeOnTheScreen();
    expect(
      screen.getByText("Crea uno para subir tus PDFs y empezar a estudiar."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("0 proyectos")).toBeNull();
    await user.press(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(screen.getByLabelText("Nombre")).toBeOnTheScreen();
  });

  it("shows the load error and retries", async () => {
    mockApi.get
      .mockRejectedValueOnce(new ApiError(500, "Servidor caído"))
      .mockResolvedValueOnce([biology]);
    const user = userEvent.setup();
    await renderWithQueryClient(<ProjectsScreen />);

    expect(await screen.findByText("Servidor caído")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Biología")).toBeOnTheScreen();
    expect(screen.queryByText("Servidor caído")).not.toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it("opens a project when it is tapped", async () => {
    mockApi.get.mockResolvedValue([biology]);
    const user = userEvent.setup();
    await renderWithQueryClient(<ProjectsScreen />);

    await user.press(await screen.findByText("Biología"));

    expect(mockReplace).toHaveBeenCalledWith("/projects/p1");
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it("switches from the project it was opened over", async () => {
    mockCanDismiss = true;
    mockApi.get.mockResolvedValue([biology]);
    const user = userEvent.setup();
    await renderWithQueryClient(<ProjectsScreen />);

    await user.press(await screen.findByText("Biología"));

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/projects/p1");
    mockCanDismiss = false;
  });

  describe("create", () => {
    it("asks for a name before calling the API", async () => {
      mockApi.get.mockResolvedValue([]);
      await renderWithQueryClient(<ProjectsScreen />);
      await screen.findByText("Aún no tienes proyectos");

      const user = await openCreateForm();
      await user.type(screen.getByLabelText("Nombre"), "   ");
      await user.press(screen.getByRole("button", { name: "Crear" }));

      expect(screen.getByText("Escribe un nombre.")).toBeOnTheScreen();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("sends the trimmed name without a blank description and refreshes the list", async () => {
      const physics = aProject({ id: "p3", name: "Física" });
      mockApi.get.mockResolvedValueOnce([]).mockResolvedValueOnce([physics]);
      mockApi.post.mockResolvedValue(physics);
      await renderWithQueryClient(<ProjectsScreen />);
      await screen.findByText("Aún no tienes proyectos");

      const user = await openCreateForm();
      await user.type(screen.getByLabelText("Nombre"), "  Física  ");
      await user.type(screen.getByLabelText("Descripción (opcional)"), "   ");
      await user.press(screen.getByRole("button", { name: "Crear" }));

      expect(await screen.findByText("Física")).toBeOnTheScreen();
      expect(mockApi.post).toHaveBeenCalledWith("/projects", { name: "Física" });
      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(screen.queryByLabelText("Nombre")).not.toBeOnTheScreen();
    });

    it("sends the trimmed description when there is one", async () => {
      const physics = aProject({ id: "p3", name: "Física", description: "Tema 1" });
      mockApi.get.mockResolvedValueOnce([]).mockResolvedValueOnce([physics]);
      mockApi.post.mockResolvedValue(physics);
      await renderWithQueryClient(<ProjectsScreen />);
      await screen.findByText("Aún no tienes proyectos");

      const user = await openCreateForm();
      await user.type(screen.getByLabelText("Nombre"), "Física");
      await user.type(screen.getByLabelText("Descripción (opcional)"), " Tema 1 ");
      await user.press(screen.getByRole("button", { name: "Crear" }));

      expect(await screen.findByText("Tema 1")).toBeOnTheScreen();
      expect(mockApi.post).toHaveBeenCalledWith("/projects", {
        name: "Física",
        description: "Tema 1",
      });
    });

    it("shows the server error and keeps the form open", async () => {
      mockApi.get.mockResolvedValue([]);
      mockApi.post.mockRejectedValue(new ApiError(422, "Invalid request."));
      await renderWithQueryClient(<ProjectsScreen />);
      await screen.findByText("Aún no tienes proyectos");

      const user = await openCreateForm();
      await user.type(screen.getByLabelText("Nombre"), "Física");
      await user.press(screen.getByRole("button", { name: "Crear" }));

      expect(await screen.findByText("Invalid request.")).toBeOnTheScreen();
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Física");
      expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
    });
  });

  it("opens a project's options as a centred menu", async () => {
    mockApi.get.mockResolvedValue([biology]);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithQueryClient(<ProjectsScreen />);

    await user.press(await screen.findByRole("button", { name: "Opciones de Biología" }));

    expect(alert).toHaveBeenCalledWith("Biología", undefined, expect.any(Array), {
      cancelable: true,
    });
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((button) => [button.text, button.style])).toEqual([
      ["Renombrar", undefined],
      ["Eliminar", "destructive"],
      ["Cancelar", "cancel"],
    ]);
  });

  describe("rename", () => {
    it("prefills the form and sends only the changed name", async () => {
      const renamed = { ...biology, name: "Biología II" };
      mockApi.get.mockResolvedValueOnce([biology]).mockResolvedValueOnce([renamed]);
      mockApi.patch.mockResolvedValue(renamed);
      await renderWithQueryClient(<ProjectsScreen />);

      const user = await openRenameForm("Biología");
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Biología");
      expect(screen.getByLabelText("Descripción (opcional)")).toHaveDisplayValue(
        "Apuntes del tema 3",
      );
      await user.clear(screen.getByLabelText("Nombre"));
      await user.type(screen.getByLabelText("Nombre"), "Biología II ");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByText("Biología II")).toBeOnTheScreen();
      expect(mockApi.patch).toHaveBeenCalledWith("/projects/p1", { name: "Biología II" });
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it("clears the description by sending null", async () => {
      const cleared = { ...biology, description: null };
      mockApi.get.mockResolvedValueOnce([biology]).mockResolvedValueOnce([cleared]);
      mockApi.patch.mockResolvedValue(cleared);
      await renderWithQueryClient(<ProjectsScreen />);

      const user = await openRenameForm("Biología");
      await user.clear(screen.getByLabelText("Descripción (opcional)"));
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(screen.queryByText("Apuntes del tema 3")).not.toBeOnTheScreen());
      expect(mockApi.patch).toHaveBeenCalledWith("/projects/p1", { description: null });
    });

    it("closes without a request when nothing changed", async () => {
      mockApi.get.mockResolvedValue([biology]);
      await renderWithQueryClient(<ProjectsScreen />);

      const user = await openRenameForm("Biología");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(screen.queryByLabelText("Nombre")).not.toBeOnTheScreen());
      expect(mockApi.patch).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("asks for confirmation, deletes and refreshes the list", async () => {
      mockApi.get.mockResolvedValueOnce([biology, history]).mockResolvedValueOnce([history]);
      mockApi.delete.mockResolvedValue(undefined);
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      await renderWithQueryClient(<ProjectsScreen />);

      await user.press(await screen.findByRole("button", { name: "Opciones de Biología" }));
      await pressAlertButton("Eliminar");

      expect(alert).toHaveBeenCalledWith(
        "¿Eliminar proyecto?",
        "Se borrarán también sus documentos, chats y flashcards.",
        expect.any(Array),
        expect.anything(),
      );
      expect(mockApi.delete).not.toHaveBeenCalled();
      const buttons = alert.mock.calls[1][2] as AlertButton[];
      expect(buttons.map((button) => button.text)).toEqual(["Cancelar", "Eliminar"]);
      const destructive = buttons.find((button) => button.style === "destructive");
      await act(async () => destructive?.onPress?.());

      await waitFor(() => expect(screen.queryByText("Biología")).not.toBeOnTheScreen());
      expect(mockApi.delete).toHaveBeenCalledWith("/projects/p1");
      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Historia")).toBeOnTheScreen();
    });

    it("tells the user when the delete fails", async () => {
      mockApi.get.mockResolvedValue([biology]);
      mockApi.delete.mockRejectedValue(new ApiError(404, "Not found."));
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      await renderWithQueryClient(<ProjectsScreen />);

      await user.press(await screen.findByRole("button", { name: "Opciones de Biología" }));
      await pressAlertButton("Eliminar");
      const buttons = alert.mock.calls[1][2] as AlertButton[];
      await act(async () => buttons.find((button) => button.style === "destructive")?.onPress?.());

      await waitFor(() =>
        expect(alert).toHaveBeenLastCalledWith("No se pudo eliminar el proyecto", "Not found."),
      );
      expect(screen.getByText("Biología")).toBeOnTheScreen();
    });
  });
});

import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { ApiError } from "@/shared/api";
import { createFakeApi, renderWithQueryClient } from "@/shared/testing/query";
import { colors } from "@/shared/theme";

import { DocumentsSection } from "./DocumentsSection";
import { aDocument } from "./testing/documents";
import { formFields, recordFormData } from "./testing/formData";

const mockApi = createFakeApi();
const mockGetDocumentAsync = jest.fn();
const mockFetch = jest.fn();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

recordFormData();

const MB = 1024 * 1024;
const tema1 = aDocument({
  id: "d1",
  name: "Tema 1.pdf",
  status: "ready",
  page_count: 12,
  size_bytes: 1.5 * MB,
});
const picked = { uri: "file:///cache/tema-2.pdf", name: "Tema 2.pdf", size: 2 * MB };
const created = aDocument({ id: "d2", name: "Tema 2.pdf", status: "pending", size_bytes: 2 * MB });
const upload = { url: "http://192.168.1.10:8000/local-uploads", fields: { key: "k/d2.pdf" } };

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  for (const method of Object.values(mockApi)) method.mockReset();
  mockGetDocumentAsync.mockReset();
  mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [picked] });
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 204 });
  globalThis.fetch = mockFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

async function pressUpload() {
  const user = userEvent.setup();
  await user.press(await screen.findByRole("button", { name: "Subir PDF" }));
  return user;
}

describe("DocumentsSection", () => {
  it("lists the documents with their details and processing states", async () => {
    mockApi.get.mockResolvedValue([
      tema1,
      aDocument({ id: "d2", name: "Tema 2.pdf", status: "pending", size_bytes: 2 * MB }),
      aDocument({ id: "d3", name: "Tema 3.pdf", status: "processing" }),
      aDocument({
        id: "d4",
        name: "Tema 4.pdf",
        status: "failed",
        error_message: "El PDF no tiene texto.",
      }),
    ]);

    await renderWithQueryClient(<DocumentsSection projectId="p1" />);

    expect(await screen.findByText("Tema 1.pdf")).toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledWith("/projects/p1/documents");
    expect(screen.getByText("12 páginas · 1,5 MB")).toBeOnTheScreen();
    expect(screen.getByText("2,0 MB")).toBeOnTheScreen();
    expect(screen.getByText("En cola")).toBeOnTheScreen();
    expect(screen.getByText("Procesando…")).toBeOnTheScreen();
    expect(screen.getByText("Error")).toHaveStyle({ color: colors.light.danger });
    const failure = screen.getByText("El PDF no tiene texto.");
    expect(failure).toHaveStyle({ color: colors.light.textMuted });
    expect(failure).toHaveProp("numberOfLines", 2);
    // A ready document has no badge: four rows, three badges.
    expect(screen.getAllByText(/^(En cola|Procesando…|Error)$/)).toHaveLength(3);
  });

  it("shows the empty state when there are no documents", async () => {
    mockApi.get.mockResolvedValue([]);

    await renderWithQueryClient(<DocumentsSection projectId="p1" />);

    expect(await screen.findByText("Aún no hay documentos")).toBeOnTheScreen();
    expect(screen.getByText("Sube un PDF para poder chatear y estudiar con él.")).toBeOnTheScreen();
  });

  it("shows the load error and retries", async () => {
    mockApi.get
      .mockRejectedValueOnce(new ApiError(500, "Servidor caído"))
      .mockResolvedValueOnce([tema1]);
    const user = userEvent.setup();
    await renderWithQueryClient(<DocumentsSection projectId="p1" />);

    expect(await screen.findByText("Servidor caído")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Tema 1.pdf")).toBeOnTheScreen();
    expect(screen.queryByText("Servidor caído")).not.toBeOnTheScreen();
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  describe("upload", () => {
    it("creates the document, uploads the file without the session token and refreshes", async () => {
      mockApi.get.mockResolvedValueOnce([tema1]).mockResolvedValue([tema1, created]);
      mockApi.post.mockResolvedValue({ document: created, upload });
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      await pressUpload();

      expect(await screen.findByText("Tema 2.pdf")).toBeOnTheScreen();
      expect(screen.getByText("En cola")).toBeOnTheScreen();
      expect(mockGetDocumentAsync).toHaveBeenCalledWith({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      expect(mockApi.post).toHaveBeenCalledWith("/projects/p1/documents", {
        name: "Tema 2.pdf",
        size_bytes: 2 * MB,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(upload.url);
      expect(init).toEqual({ method: "POST", body: expect.anything() });
      expect(formFields(init.body)).toEqual([
        ["key", "k/d2.pdf"],
        ["file", { uri: picked.uri, name: "Tema 2.pdf", type: "application/pdf" }],
      ]);
      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Subir PDF" })).toBeEnabled();
    });

    it("does nothing when the picker is cancelled", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      await pressUpload();

      await waitFor(() => expect(screen.getByRole("button", { name: "Subir PDF" })).toBeEnabled());
      expect(mockApi.post).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it.each([
      [
        "a file that is not a PDF",
        { ...picked, name: "apuntes.docx" },
        "Solo se pueden subir archivos PDF.",
      ],
      ["a PDF over 25 MB", { ...picked, size: 25 * MB + 1 }, "El PDF supera el límite de 25 MB."],
    ])("refuses %s without any request", async (_, file, message) => {
      mockApi.get.mockResolvedValue([tema1]);
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [file] });
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      await pressUpload();

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(mockApi.post).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows the server's message when the project is full", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      mockApi.post.mockRejectedValue(new ApiError(409, "A project holds at most 20 documents."));
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      await pressUpload();

      expect(await screen.findByText("A project holds at most 20 documents.")).toBeOnTheScreen();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("deletes the half-created document when the upload fails", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      mockApi.post.mockResolvedValue({ document: created, upload });
      mockApi.delete.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({ ok: false, status: 403 });
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      await pressUpload();

      expect(
        await screen.findByText("No se pudo subir el PDF. Inténtalo de nuevo."),
      ).toBeOnTheScreen();
      expect(mockApi.delete).toHaveBeenCalledWith("/documents/d2");
      expect(screen.queryByText("Tema 2.pdf")).not.toBeOnTheScreen();
    });

    it("ignores a second upload while the first is running", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      let finish: (value: unknown) => void = () => {};
      mockApi.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const user = await pressUpload();
      const button = screen.getByRole("button", { name: "Subir PDF" });
      expect(button).toBeBusy();
      await user.press(button);

      expect(mockGetDocumentAsync).toHaveBeenCalledTimes(1);
      expect(mockApi.post).toHaveBeenCalledTimes(1);
      await act(async () => finish({ document: created, upload }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Subir PDF" })).toBeEnabled());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("rename", () => {
    async function openRenameForm() {
      const user = userEvent.setup();
      await user.longPress(await screen.findByText("Tema 1.pdf"));
      await user.press(screen.getByRole("button", { name: "Renombrar" }));
      return user;
    }

    it("prefills the name and sends the trimmed new one", async () => {
      const renamed = { ...tema1, name: "Genética.pdf" };
      mockApi.get.mockResolvedValueOnce([tema1]).mockResolvedValue([renamed]);
      mockApi.patch.mockResolvedValue(renamed);
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const user = await openRenameForm();
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Tema 1.pdf");
      await user.clear(screen.getByLabelText("Nombre"));
      await user.type(screen.getByLabelText("Nombre"), " Genética.pdf ");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByText("Genética.pdf")).toBeOnTheScreen();
      expect(mockApi.patch).toHaveBeenCalledWith("/documents/d1", { name: "Genética.pdf" });
      expect(mockApi.get).toHaveBeenCalledTimes(2);
      expect(screen.queryByLabelText("Nombre")).not.toBeOnTheScreen();
    });

    it("asks for a name before calling the API", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const user = await openRenameForm();
      await user.clear(screen.getByLabelText("Nombre"));
      await user.type(screen.getByLabelText("Nombre"), "   ");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      expect(screen.getByText("Escribe un nombre.")).toBeOnTheScreen();
      expect(screen.getByLabelText("Nombre")).toHaveProp("maxLength", 200);
      expect(mockApi.patch).not.toHaveBeenCalled();
    });

    it("closes without a request when the name did not change", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const user = await openRenameForm();
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(screen.queryByLabelText("Nombre")).not.toBeOnTheScreen());
      expect(mockApi.patch).not.toHaveBeenCalled();
    });

    it("shows the server error and keeps the form open", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      mockApi.patch.mockRejectedValue(new ApiError(404, "Not found."));
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const user = await openRenameForm();
      await user.type(screen.getByLabelText("Nombre"), "x");
      await user.press(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByText("Not found.")).toBeOnTheScreen();
      expect(screen.getByLabelText("Nombre")).toHaveDisplayValue("Tema 1.pdfx");
    });
  });

  describe("delete", () => {
    async function pressDelete() {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const user = userEvent.setup();
      await user.press(await screen.findByRole("button", { name: "Opciones de Tema 1.pdf" }));
      await user.press(screen.getByRole("button", { name: "Eliminar" }));
      return alert;
    }

    it("asks for confirmation, deletes and refreshes the list", async () => {
      mockApi.get.mockResolvedValueOnce([tema1]).mockResolvedValue([]);
      mockApi.delete.mockResolvedValue(undefined);
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const alert = await pressDelete();

      expect(alert).toHaveBeenCalledWith(
        "¿Eliminar documento?",
        "Se borrarán también sus resúmenes, flashcards y tests.",
        expect.any(Array),
        expect.anything(),
      );
      expect(mockApi.delete).not.toHaveBeenCalled();
      const buttons = alert.mock.calls[0][2] as AlertButton[];
      expect(buttons.map((button) => [button.text, button.style])).toEqual([
        ["Cancelar", "cancel"],
        ["Eliminar", "destructive"],
      ]);
      await act(async () => buttons[1].onPress?.());

      expect(await screen.findByText("Aún no hay documentos")).toBeOnTheScreen();
      expect(mockApi.delete).toHaveBeenCalledWith("/documents/d1");
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it("keeps the document when the user cancels", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const alert = await pressDelete();
      const buttons = alert.mock.calls[0][2] as AlertButton[];
      await act(async () => buttons[0].onPress?.());

      expect(mockApi.delete).not.toHaveBeenCalled();
      expect(screen.getByText("Tema 1.pdf")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Renombrar" })).not.toBeOnTheScreen();
    });

    it("tells the user when the delete fails", async () => {
      mockApi.get.mockResolvedValue([tema1]);
      mockApi.delete.mockRejectedValue(new ApiError(404, "Not found."));
      await renderWithQueryClient(<DocumentsSection projectId="p1" />);

      const alert = await pressDelete();
      const buttons = alert.mock.calls[0][2] as AlertButton[];
      await act(async () => buttons[1].onPress?.());

      await waitFor(() =>
        expect(alert).toHaveBeenLastCalledWith("No se pudo eliminar el documento", "Not found."),
      );
      expect(screen.getByText("Tema 1.pdf")).toBeOnTheScreen();
    });
  });
});

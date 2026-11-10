import * as DocumentPicker from "expo-document-picker";

import { ApiError } from "@/shared/api";
import { createFakeApi } from "@/shared/testing/query";

import { aDocument } from "./testing/documents";
import { formFields, recordFormData } from "./testing/formData";
import { MAX_PDF_BYTES, pickPdf, uploadPdf, type PickedPdf } from "./upload";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

recordFormData();

const pdf: PickedPdf = { uri: "file:///cache/tema-1.pdf", name: "Tema 1.PDF", size: 2048 };
const created = aDocument({ id: "d1", name: "Tema 1.PDF", status: "pending", size_bytes: 2048 });
const upload = {
  url: "http://192.168.1.10:8000/local-uploads",
  fields: { key: "users/u1/projects/p1/d1.pdf", policy: "cG9saWN5", "x-amz-signature": "sig" },
};

function setup(picked: PickedPdf | null = pdf) {
  const api = createFakeApi();
  api.post.mockResolvedValue({ document: created, upload });
  api.delete.mockResolvedValue(undefined);
  const fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  const pick = jest.fn().mockResolvedValue(picked);
  const run = () => uploadPdf({ projectId: "p1", pick, api, fetch });
  return { api, fetch, pick, run };
}

describe("uploadPdf", () => {
  it("creates the document, then posts every field and the file last to the upload URL", async () => {
    const { api, fetch, run } = setup();

    await expect(run()).resolves.toEqual(created);

    expect(api.post).toHaveBeenCalledWith("/projects/p1/documents", {
      name: "Tema 1.PDF",
      size_bytes: 2048,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(upload.url);
    expect(init.method).toBe("POST");
    // A presigned S3 POST rejects extra auth, so the Cognito token never goes there.
    expect(init.headers).toBeUndefined();
    expect(formFields(init.body)).toEqual([
      ["key", "users/u1/projects/p1/d1.pdf"],
      ["policy", "cG9saWN5"],
      ["x-amz-signature", "sig"],
      ["file", { uri: pdf.uri, name: "Tema 1.PDF", type: "application/pdf" }],
    ]);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("accepts a PDF of exactly 30 MB", async () => {
    const { api, run } = setup({ ...pdf, size: MAX_PDF_BYTES });

    await run();

    expect(api.post).toHaveBeenCalledWith("/projects/p1/documents", {
      name: "Tema 1.PDF",
      size_bytes: 30 * 1024 * 1024,
    });
  });

  it("does nothing when the picker is cancelled", async () => {
    const { api, fetch, run } = setup(null);

    await expect(run()).resolves.toBeNull();

    expect(api.post).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a file that is not a PDF without any request", async () => {
    const { api, fetch, run } = setup({ ...pdf, name: "apuntes.docx" });

    await expect(run()).rejects.toThrow("Solo se pueden subir archivos PDF.");

    expect(api.post).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["is over 30 MB", MAX_PDF_BYTES + 1],
    ["has an unknown size", undefined],
  ])("rejects a PDF that %s without any request", async (_, size) => {
    const { api, fetch, run } = setup({ ...pdf, size });

    await expect(run()).rejects.toThrow("El PDF supera el límite de 30 MB.");

    expect(api.post).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes on the server's message when the project is full", async () => {
    const { api, fetch, run } = setup();
    api.post.mockRejectedValue(new ApiError(409, "A project holds at most 20 documents."));

    await expect(run()).rejects.toThrow("A project holds at most 20 documents.");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes the half-created document when the upload is refused", async () => {
    const { api, fetch, run } = setup();
    fetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(run()).rejects.toThrow("No se pudo subir el PDF. Inténtalo de nuevo.");

    expect(api.delete).toHaveBeenCalledWith("/documents/d1");
  });

  it("deletes the half-created document on a network failure and ignores a failed delete", async () => {
    const { api, fetch, run } = setup();
    fetch.mockRejectedValue(new TypeError("Network request failed"));
    api.delete.mockRejectedValue(new ApiError(500, "Boom"));

    await expect(run()).rejects.toThrow("No se pudo subir el PDF. Inténtalo de nuevo.");

    expect(api.delete).toHaveBeenCalledWith("/documents/d1");
  });
});

describe("pickPdf", () => {
  const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

  it("opens the picker for one PDF copied to the cache and returns it", async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: pdf.uri, name: pdf.name, size: 2048, mimeType: "application/pdf" }],
    });

    await expect(pickPdf()).resolves.toEqual({ uri: pdf.uri, name: pdf.name, size: 2048 });

    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it("returns null when the user cancels", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(pickPdf()).resolves.toBeNull();
  });
});

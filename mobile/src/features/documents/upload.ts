// Uploading a PDF (docs/app/README.md § Subir un PDF): create the document through the API, then
// send the file to the URL it returns. That URL is a presigned S3 POST in AWS and the API's
// `/local-uploads` locally; both take the same multipart form.

import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";

import type { ApiClient } from "@/shared/api";

import type { Document, DocumentCreated } from "./api";

export const MAX_PDF_BYTES = 30 * 1024 * 1024;

export type PickedPdf = { uri: string; name: string; size?: number | null };

type UploadResponse = { ok: boolean };

type Dependencies = {
  projectId: string;
  /** Resolves the chosen file, or null when the user cancels. */
  pick: () => Promise<PickedPdf | null>;
  api: Pick<ApiClient, "post" | "delete">;
  /** Plain fetch: the upload URL must not receive the session's Authorization header. */
  fetch: (url: string, init: { method: "POST"; body: FormData }) => Promise<UploadResponse>;
};

/** Resolves the created document, or null when the picker was cancelled. Errors carry UI copy. */
export async function uploadPdf({
  projectId,
  pick,
  api,
  fetch,
}: Dependencies): Promise<Document | null> {
  const file = await pick();
  if (!file) return null;

  const problem = pdfProblem(file);
  if (problem) throw new Error(problem);

  const { document, upload } = await api.post<DocumentCreated>(`/projects/${projectId}/documents`, {
    name: file.name,
    size_bytes: file.size,
  });

  if (!(await send(fetch, upload, file))) {
    // The document row exists but will never get its file: remove it so it does not linger.
    await api.delete(`/documents/${document.id}`).catch(() => undefined);
    throw new Error("No se pudo subir el PDF. Inténtalo de nuevo.");
  }
  return document;
}

function pdfProblem(file: PickedPdf): string | undefined {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Solo se pueden subir archivos PDF.";
  if (file.size == null || file.size > MAX_PDF_BYTES) return "El PDF supera el límite de 30 MB.";
  return undefined;
}

async function send(
  fetch: Dependencies["fetch"],
  upload: DocumentCreated["upload"],
  file: PickedPdf,
): Promise<boolean> {
  const body = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
  // S3 ignores every field after the file, so it goes last. Expo's global fetch only accepts Blob
  // parts (React Native's `{ uri, name, type }` throws), and expo-file-system's File is one.
  body.append("file", new File(file.uri));
  try {
    const response = await fetch(upload.url, { method: "POST", body });
    return response.ok;
  } catch (error) {
    if (__DEV__) console.warn("PDF upload failed", error);
    return false;
  }
}

/** Opens the system picker for one PDF. */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri, name: asset.name, size: asset.size } : null;
}

// How a document's metadata reads in the list.

import type { Document } from "./api";

const MB = 1024 * 1024;

/** Pages once processed and the file size when known, e.g. "12 páginas · 1,5 MB". */
export function documentDetails(document: Document): string | undefined {
  const parts: string[] = [];
  if (document.status === "ready" && document.page_count != null) {
    parts.push(document.page_count === 1 ? "1 página" : `${document.page_count} páginas`);
  }
  if (document.size_bytes != null) parts.push(megabytes(document.size_bytes));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

// One decimal with a Spanish decimal comma; tiny files still read as 0,1 MB rather than 0,0.
function megabytes(bytes: number): string {
  return `${Math.max(bytes / MB, 0.1)
    .toFixed(1)
    .replace(".", ",")} MB`;
}

export function statusLabel(status: Document["status"]): string | undefined {
  if (status === "pending") return "En cola";
  if (status === "processing") return "Procesando…";
  if (status === "failed") return "Error";
  return undefined;
}

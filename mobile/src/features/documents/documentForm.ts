// The rename form's rules and how its value becomes a request body.

import type { Document, DocumentChanges } from "./api";

export const NAME_MAX_LENGTH = 200;

export function nameError(name: string): string | undefined {
  return name.trim() ? undefined : "Escribe un nombre.";
}

/** The new name, or nothing when it did not change. */
export function toChanges(document: Document, name: string): DocumentChanges | undefined {
  const trimmed = name.trim();
  return trimmed === document.name ? undefined : { name: trimmed };
}

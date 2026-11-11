// The create sheet's values and how they become a request.

import type { Document } from "@/features/documents";

import type { NewStudyItem } from "./api";

export const TOPIC_MAX_LENGTH = 200;
export const MAX_COUNT = 30;
const DEFAULT_COUNT = 10;

export type StudyFormValues = { documentId: string; topic: string; count: string };

export function formValues(documents: Document[]): StudyFormValues {
  return { documentId: documents[0]?.id ?? "", topic: "", count: String(DEFAULT_COUNT) };
}

export function countError(values: StudyFormValues): string | undefined {
  const count = Number(values.count);
  const valid = /^\d+$/.test(values.count.trim()) && count >= 1 && count <= MAX_COUNT;
  return valid ? undefined : `Elige un número entre 1 y ${MAX_COUNT}.`;
}

export function toNewItem(values: StudyFormValues): NewStudyItem {
  return {
    documentId: values.documentId,
    count: Number(values.count),
    topic: values.topic.trim() || null,
  };
}

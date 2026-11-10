import type { Document } from "../api";

export function aDocument(overrides: Partial<Document> & Pick<Document, "id" | "name">): Document {
  return {
    project_id: "p1",
    s3_key: `users/u1/projects/p1/${overrides.id}.pdf`,
    size_bytes: null,
    page_count: null,
    status: "ready",
    error_message: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

import type { Project } from "../api";

export function aProject(overrides: Partial<Project> & Pick<Project, "id" | "name">): Project {
  return {
    description: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

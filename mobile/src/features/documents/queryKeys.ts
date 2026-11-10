/** Query keys of the documents feature. They nest under the projects' key, so they live with it. */
export const documentKeys = {
  list: (projectId: string) => ["projects", projectId, "documents"] as const,
};

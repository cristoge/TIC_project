import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApi } from "@/core/api";
import type { Schemas } from "@/shared/api";

import { documentKeys } from "./queryKeys";
import { pickPdf, uploadPdf } from "./upload";

export type Document = Schemas["DocumentOut"];
export type DocumentCreated = Schemas["DocumentCreatedOut"];
export type DocumentChanges = Schemas["DocumentUpdate"];

/** How often the list is refetched while a document is still being processed. */
export const DOCUMENT_POLL_MS = 3000;

export function isProcessing(document: Document): boolean {
  return document.status === "pending" || document.status === "processing";
}

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: documentKeys.list(projectId),
    queryFn: () => getApi().get<Document[]>(`/projects/${projectId}/documents`),
    refetchInterval: (query) => (query.state.data?.some(isProcessing) ? DOCUMENT_POLL_MS : false),
  });
}

// Returning the promise keeps the mutation pending until the list has been refetched.
function useRefreshDocuments(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: documentKeys.list(projectId) });
}

/** Picks a PDF and uploads it. Resolves null when the picker is cancelled. */
export function useUploadDocument(projectId: string) {
  const refresh = useRefreshDocuments(projectId);
  return useMutation({
    mutationFn: () =>
      uploadPdf({
        projectId,
        pick: pickPdf,
        api: getApi(),
        // Read at call time so tests can replace the global.
        fetch: (url, init) => globalThis.fetch(url, init),
      }),
    onSuccess: (document) => (document ? refresh() : undefined),
  });
}

export function useRenameDocument(projectId: string) {
  const refresh = useRefreshDocuments(projectId);
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: DocumentChanges }) =>
      getApi().patch<Document>(`/documents/${id}`, changes),
    onSuccess: refresh,
  });
}

export function useDeleteDocument(projectId: string) {
  const refresh = useRefreshDocuments(projectId);
  return useMutation({
    mutationFn: (id: string) => getApi().delete(`/documents/${id}`),
    onSuccess: refresh,
  });
}

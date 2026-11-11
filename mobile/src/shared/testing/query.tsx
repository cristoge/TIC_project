// Test helpers for screens that read server data through TanStack Query and the app's REST client.

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

import { createQueryClient, type ApiClient } from "@/shared/api";

/** The app's query client without retries, so a failing request shows its error at once. */
export function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...defaults,
    // gcTime Infinity schedules no garbage-collection timers that outlive the test.
    queries: { ...defaults.queries, retry: false, gcTime: Infinity },
    // A finished mutation's timer is real and would keep Jest from exiting for five minutes.
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  return queryClient;
}

export function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Renders `ui` inside a fresh query client. */
export async function renderWithQueryClient(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  const result = await render(ui, { wrapper: queryWrapper(queryClient) });
  return { ...result, queryClient };
}

export type FakeApi = { [Method in keyof ApiClient]: jest.Mock };

/** Stand-in for `getApi()`: `jest.mock("@/core/api", () => ({ getApi: () => mockApi }))`. */
export function createFakeApi(): FakeApi {
  return { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() };
}

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createFakeApi, createTestQueryClient, queryWrapper } from "@/shared/testing/query";

import { useDocuments } from "./api";
import { aDocument } from "./testing/documents";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

const ready = aDocument({ id: "d1", name: "Tema 1.pdf", status: "ready", page_count: 12 });

beforeEach(() => {
  jest.useFakeTimers();
  mockApi.get.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderDocuments() {
  const wrapper = queryWrapper(createTestQueryClient());
  return renderHook(() => useDocuments("p1"), { wrapper });
}

describe("useDocuments", () => {
  it.each(["pending", "processing"] as const)(
    "polls every 3 s while a document is %s and stops once none is in progress",
    async (status) => {
      const inProgress = { ...ready, status, page_count: null };
      mockApi.get.mockResolvedValueOnce([inProgress]).mockResolvedValue([ready]);

      const { result } = await renderDocuments();
      await waitFor(() => expect(result.current.data).toEqual([inProgress]));
      expect(mockApi.get).toHaveBeenCalledWith("/projects/p1/documents");

      await act(() => jest.advanceTimersByTimeAsync(2900));
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTimeAsync(100));
      await waitFor(() => expect(result.current.data).toEqual([ready]));
      expect(mockApi.get).toHaveBeenCalledTimes(2);

      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    },
  );

  it("does not poll when every document is ready or failed", async () => {
    const failed = aDocument({ id: "d2", name: "Roto.pdf", status: "failed" });
    mockApi.get.mockResolvedValue([ready, failed]);

    const { result } = await renderDocuments();
    await waitFor(() => expect(result.current.data).toEqual([ready, failed]));

    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });
});

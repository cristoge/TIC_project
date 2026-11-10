import { renderHook, waitFor } from "@testing-library/react-native";

import { createFakeApi, createTestQueryClient, queryWrapper } from "@/shared/testing/query";

import { useProjectName } from "./api";
import { aProject } from "./testing/projects";

const mockApi = createFakeApi();

jest.mock("@/core/api", () => ({ getApi: () => mockApi }));

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.get.mockResolvedValue([aProject({ id: "p1", name: "Biología" })]);
});

describe("useProjectName", () => {
  it("reads the name from the projects list", async () => {
    const wrapper = queryWrapper(createTestQueryClient());

    const { result } = await renderHook(() => useProjectName("p1"), { wrapper });

    await waitFor(() => expect(result.current).toBe("Biología"));
    expect(mockApi.get).toHaveBeenCalledWith("/projects");
  });

  it("falls back to a generic title for an unknown project", async () => {
    const wrapper = queryWrapper(createTestQueryClient());

    const { result } = await renderHook(() => useProjectName("missing"), { wrapper });

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(result.current).toBe("Proyecto");
  });
});

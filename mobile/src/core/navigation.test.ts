import { renderHook } from "@testing-library/react-native";

import { useStackScreenOptions } from "./navigation";

it("shows the back button as an arrow alone, without the previous screen's name", async () => {
  const { result } = await renderHook(() => useStackScreenOptions());

  expect(result.current.headerBackButtonDisplayMode).toBe("minimal");
});

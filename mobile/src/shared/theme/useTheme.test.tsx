import { renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";

import { colors } from "./tokens";
import { useTheme } from "./useTheme";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe("useTheme", () => {
  it("follows a dark system scheme", async () => {
    mockedScheme.mockReturnValue("dark");
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe("dark");
    expect(result.current.colors).toEqual(colors.dark);
  });

  it("falls back to light when the system has no preference", async () => {
    mockedScheme.mockReturnValue(null);
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe("light");
    expect(result.current.colors).toEqual(colors.light);
  });
});

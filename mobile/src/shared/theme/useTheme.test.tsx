import { act, renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";

import { useThemePreference } from "./themePreference";
import { colors } from "./tokens";
import { useTheme } from "./useTheme";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

afterEach(() => useThemePreference.setState({ preference: "system" }));

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

  it("uses the scheme the user chose over the system's", async () => {
    mockedScheme.mockReturnValue("dark");
    useThemePreference.setState({ preference: "light" });
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe("light");
  });

  it("switches when the user chooses another scheme", async () => {
    mockedScheme.mockReturnValue("light");
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe("light");

    await act(() => useThemePreference.setState({ preference: "dark" }));

    expect(result.current.colors).toEqual(colors.dark);
  });
});

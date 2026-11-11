import { useMemo } from "react";
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useThemePreference } from "./themePreference";
import { colors, radii, spacing, typography, type ColorScheme, type Colors } from "./tokens";

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

// Built once so each scheme keeps a stable identity for memoized styles.
const themes: Record<ColorScheme, Theme> = {
  light: { scheme: "light", colors: colors.light, spacing, radii, typography },
  dark: { scheme: "dark", colors: colors.dark, spacing, radii, typography },
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useThemePreference((state) => state.preference);
  if (preference !== "system") return themes[preference];
  return themes[system === "dark" ? "dark" : "light"];
}

/** Styles that depend on the theme. Declare `factory` at module level so it stays stable. */
export function useThemedStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}

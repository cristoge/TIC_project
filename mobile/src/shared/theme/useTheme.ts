import { useMemo } from "react";
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useThemePreference } from "./themePreference";
import {
  accents,
  colorsFor,
  radii,
  spacing,
  typography,
  type AccentName,
  type ColorScheme,
  type Colors,
} from "./tokens";

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

// Built once so each scheme and accent keeps a stable identity for memoized styles.
const themes = Object.fromEntries(
  (["light", "dark"] as const).map((scheme) => [
    scheme,
    Object.fromEntries(
      (Object.keys(accents) as AccentName[]).map((accent) => [
        accent,
        { scheme, colors: colorsFor(scheme, accent), spacing, radii, typography },
      ]),
    ),
  ]),
) as Record<ColorScheme, Record<AccentName, Theme>>;

export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useThemePreference((state) => state.preference);
  const accent = useThemePreference((state) => state.accent);
  const scheme = preference !== "system" ? preference : system === "dark" ? "dark" : "light";
  return themes[scheme][accent];
}

/** Styles that depend on the theme. Declare `factory` at module level so it stays stable. */
export function useThemedStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}

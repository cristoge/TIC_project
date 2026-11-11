// Design tokens. Values and rationale: docs/app/README.md § Estética.

export const colors = {
  light: {
    background: "#FFFFFF",
    // Grouped content, inputs and the side menu sit one step off the background.
    surface: "#F6F7F9",
    text: "#111827",
    textMuted: "#4B5563",
    border: "#E5E7EB",
    // Cobalt blue for the main action of a screen, links and the current selection.
    accent: "#0047AB",
    onAccent: "#FFFFFF",
    // Tinted background for badges and the selected menu entry.
    accentSoft: "#E6EEF9",
    danger: "#B42318",
  },
  dark: {
    background: "#0E1116",
    surface: "#171B22",
    text: "#F3F4F6",
    textMuted: "#A1A8B3",
    border: "#2A303A",
    // A lighter cobalt so it reads as text on the dark background. No blue does that and also
    // carries white text at AA, so text on it is dark here.
    accent: "#6E97F2",
    onAccent: "#0E1116",
    accentSoft: "#1B2840",
    danger: "#F97066",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorName = keyof (typeof colors)["light"];
export type Colors = Record<ColorName, string>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// Names registered with useFonts in the root layout.
export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
} as const;

export const typography = {
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
} as const;

export type TypographyVariant = keyof typeof typography;

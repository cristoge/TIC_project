// Design tokens. Values and rationale: docs/app/README.md § Estética.

export const colors = {
  light: {
    background: "#F6F4F1",
    surface: "#FFF2EA",
    text: "#1E1814",
    textMuted: "#6B5843",
    border: "#E7DED6",
    // Only for actions. White on it fails WCAG AA, so text on the accent is always dark.
    accent: "#FF6400",
    onAccent: "#1E1814",
    accentSoft: "#FAAD45",
    danger: "#B42318",
  },
  dark: {
    background: "#1E1814",
    surface: "#2A231E",
    text: "#F6F4F1",
    textMuted: "#B8ADA3",
    border: "#3D342E",
    accent: "#FF6400",
    onAccent: "#1E1814",
    accentSoft: "#FAAD45",
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
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
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
} as const;

export type TypographyVariant = keyof typeof typography;

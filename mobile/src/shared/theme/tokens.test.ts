import { accents, colors, colorsFor, type AccentName, type ColorName } from "./tokens";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const readablePairs: [ColorName, ColorName][] = [
  ["text", "background"],
  ["text", "surface"],
  ["textMuted", "background"],
  ["textMuted", "surface"],
  ["onAccent", "accent"],
  ["text", "accentSoft"],
  ["accentText", "background"],
  ["accentText", "surface"],
  ["accentText", "accentSoft"],
  ["danger", "background"],
];

it("uses the near-black #111112 as the dark background", () => {
  expect(colors.dark.background).toBe("#111112");
});

describe.each(["light", "dark"] as const)("%s colors", (scheme) => {
  it.each(readablePairs)("%s on %s meets WCAG AA (4.5:1)", (foreground, background) => {
    expect(contrast(colors[scheme][foreground], colors[scheme][background])).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("uses #66A3FF as the accent", () => {
    expect(colors[scheme].accent).toBe("#66A3FF");
  });

  it.each(Object.keys(accents) as AccentName[])(
    "keeps every pair readable with the %s accent",
    (accent) => {
      const palette = colorsFor(scheme, accent);
      for (const [foreground, background] of readablePairs) {
        expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("defaults to the blue accent", () => {
    expect(colorsFor(scheme, "blue")).toEqual(colors[scheme]);
  });

  it("keeps the background and surface neutral", () => {
    for (const name of ["background", "surface"] as const) {
      const [r, g, b] = [1, 3, 5].map((start) =>
        parseInt(colors[scheme][name].slice(start, start + 2), 16),
      );
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(16);
    }
  });
});

it("offers four accents besides blue, each changing only the accent colours", () => {
  expect(Object.keys(accents)).toEqual(["blue", "violet", "green", "orange", "pink"]);
  const green = colorsFor("light", "green");
  expect(green.accent).not.toBe(colors.light.accent);
  expect({ ...green, accent: "", accentText: "", accentSoft: "" }).toEqual({
    ...colors.light,
    accent: "",
    accentText: "",
    accentSoft: "",
  });
});

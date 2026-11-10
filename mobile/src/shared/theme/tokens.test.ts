import { colors, type ColorName } from "./tokens";

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
  ["danger", "background"],
];

describe.each(["light", "dark"] as const)("%s colors", (scheme) => {
  it.each(readablePairs)("%s on %s meets WCAG AA (4.5:1)", (foreground, background) => {
    expect(contrast(colors[scheme][foreground], colors[scheme][background])).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("uses the brand orange as the accent", () => {
    expect(colors[scheme].accent).toBe("#FF6400");
  });
});

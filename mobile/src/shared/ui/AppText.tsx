import { Text, type TextProps } from "react-native";

import { useTheme, type ColorName, type TypographyVariant } from "@/shared/theme";

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: Extract<ColorName, "text" | "textMuted" | "onAccent" | "accent" | "danger">;
};

export function AppText({ variant = "body", color = "text", style, ...props }: Props) {
  const theme = useTheme();
  return (
    <Text
      style={[
        theme.typography[variant],
        // Blue text takes the shade of the accent that reads on the background.
        { color: theme.colors[color === "accent" ? "accentText" : color] },
        style,
      ]}
      {...props}
    />
  );
}

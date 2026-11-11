import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Tone = "progress" | "danger";

type Props = {
  label: string;
  tone: Tone;
};

/** A short status next to an item, such as a document that is still processing or failed. */
export function Badge({ label, tone }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.badge, styles[tone]]}>
      <AppText variant="caption" color={tone === "danger" ? "danger" : "text"}>
        {label}
      </AppText>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  badge: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
  },
  progress: { backgroundColor: theme.colors.accentSoft },
  danger: { borderWidth: 1, borderColor: theme.colors.danger },
});

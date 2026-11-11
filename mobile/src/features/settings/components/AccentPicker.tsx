import { Pressable, View } from "react-native";

import { accents, useTheme, useThemedStyles, type AccentName, type Theme } from "@/shared/theme";
import { Icon } from "@/shared/ui";

const LABELS: Record<AccentName, string> = {
  blue: "Azul",
  violet: "Violeta",
  green: "Verde",
  orange: "Naranja",
  pink: "Rosa",
};

type Props = { value: AccentName; onChange: (accent: AccentName) => void };

/** A row of colour swatches; the chosen one is ringed and ticked. */
export function AccentPicker({ value, onChange }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {(Object.keys(accents) as AccentName[]).map((accent) => {
        const selected = accent === value;
        return (
          <Pressable
            key={accent}
            accessibilityRole="radio"
            accessibilityLabel={LABELS[accent]}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(accent)}
            style={[styles.ring, selected && { borderColor: theme.colors.text }]}
          >
            <View
              style={[styles.swatch, { backgroundColor: accents[accent][theme.scheme].accent }]}
            >
              {selected ? <Icon name="check" size={18} color="onAccent" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  row: { flexDirection: "row" as const, gap: theme.spacing.md, flexWrap: "wrap" as const },
  ring: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.pill,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});

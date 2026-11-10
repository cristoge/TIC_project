import { Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Card } from "@/shared/ui";

import type { Document } from "../api";
import { documentDetails, statusLabel } from "../documentDetails";

type Props = {
  document: Document;
  onOptions: (document: Document) => void;
};

export function DocumentRow({ document, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);
  const details = documentDetails(document);
  const status = statusLabel(document.status);

  return (
    <Card style={styles.card}>
      <Pressable
        onLongPress={() => onOptions(document)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="label">{document.name}</AppText>
        {details ? (
          <AppText variant="caption" color="textMuted">
            {details}
          </AppText>
        ) : null}
        {status ? (
          <View style={styles.status}>
            <Badge label={status} tone={document.status === "failed" ? "danger" : "progress"} />
            {document.status === "failed" && document.error_message ? (
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {document.error_message}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {/* A visible sibling (not nested) so screen readers and users unaware of long-press reach it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Opciones de ${document.name}`}
        hitSlop={8}
        onPress={() => onOptions(document)}
        style={({ pressed }) => [styles.options, pressed && styles.pressed]}
      >
        <AppText variant="heading" importantForAccessibility="no">
          ⋯
        </AppText>
      </Pressable>
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  card: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  main: { flex: 1, gap: theme.spacing.xs },
  status: { gap: theme.spacing.xs, paddingTop: theme.spacing.xs },
  options: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.pill,
  },
  pressed: { opacity: 0.6 },
});

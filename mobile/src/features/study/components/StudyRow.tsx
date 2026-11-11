import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Card } from "@/shared/ui";

import type { StudyItem } from "../api";

type Props = {
  item: StudyItem;
  /** Such as "1 tarjeta" / "3 tarjetas". */
  countLabel: (count: number) => string;
  onOpen: (item: StudyItem) => void;
  onOptions: (item: StudyItem) => void;
};

export function StudyRow({ item, countLabel, onOpen, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);
  const ready = item.status === "ready";

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => onOpen(item)}
        onLongPress={item.status === "pending" ? undefined : () => onOptions(item)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="label" testID="study-title">
          {item.title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {ready ? `${countLabel(item.count)} · ${item.documentName}` : item.documentName}
        </AppText>
        {item.status === "pending" ? <Badge label="Generando…" tone="progress" /> : null}
        {item.status === "failed" ? (
          <>
            <Badge label="No se pudo generar" tone="danger" />
            {item.error_message ? (
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {item.error_message}
              </AppText>
            ) : null}
          </>
        ) : null}
      </Pressable>
      {/* Hidden while it is being generated: its job still reads the topic and writes its rows. */}
      {item.status === "pending" ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Opciones de ${item.title}`}
          hitSlop={8}
          onPress={() => onOptions(item)}
          style={({ pressed }) => [styles.options, pressed && styles.pressed]}
        >
          <AppText variant="heading" importantForAccessibility="no">
            ⋯
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  card: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  main: { flex: 1, gap: theme.spacing.xs },
  options: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.pill,
  },
  pressed: { opacity: 0.6 },
});

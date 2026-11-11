import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Card } from "@/shared/ui";

import type { StudyItem } from "../api";

type Props = {
  item: StudyItem;
  /** Such as "1 tarjeta" / "3 tarjetas". */
  countLabel: (count: number) => string;
  onOpen: (item: StudyItem) => void;
};

export function StudyRow({ item, countLabel, onOpen }: Props) {
  const styles = useThemedStyles(createStyles);
  const ready = item.status === "ready";

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => onOpen(item)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="label" testID="study-title">
          {item.topic || "Sin tema"}
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
    </Card>
  );
}

const createStyles = (theme: Theme) => ({
  main: { gap: theme.spacing.xs },
  pressed: { opacity: 0.6 },
});

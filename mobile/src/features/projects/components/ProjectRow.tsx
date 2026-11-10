import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Card } from "@/shared/ui";

import type { Project } from "../api";

type Props = {
  project: Project;
  onOpen: (project: Project) => void;
  onOptions: (project: Project) => void;
};

export function ProjectRow({ project, onOpen, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(project)}
        onLongPress={() => onOptions(project)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="label">{project.name}</AppText>
        {project.description ? (
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {project.description}
          </AppText>
        ) : null}
      </Pressable>
      {/* A visible sibling (not nested) so screen readers and users unaware of long-press reach it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Opciones de ${project.name}`}
        hitSlop={8}
        onPress={() => onOptions(project)}
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
  options: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radii.pill,
  },
  pressed: { opacity: 0.6 },
});

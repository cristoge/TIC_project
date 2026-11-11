import { Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, Icon, IconButton, ListItem } from "@/shared/ui";

import type { Project } from "../api";

type Props = {
  project: Project;
  /** The project opened last, which the app starts in. */
  current: boolean;
  onOpen: (project: Project) => void;
  onOptions: (project: Project) => void;
};

export function ProjectRow({ project, current, onOpen, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <ListItem>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={current ? `${project.name}, proyecto actual` : project.name}
        onPress={() => onOpen(project)}
        onLongPress={() => onOptions(project)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.tile}>
          <Icon name="project" color="accent" />
        </View>
        <View style={styles.text}>
          <View style={styles.title}>
            <AppText variant="label" numberOfLines={1} style={styles.name}>
              {project.name}
            </AppText>
            {current ? <Badge label="Actual" tone="progress" /> : null}
          </View>
          {project.description ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {project.description}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            Actualizado el {updatedOn(project.updated_at)}
          </AppText>
        </View>
      </Pressable>
      <IconButton
        icon="options"
        label={`Opciones de ${project.name}`}
        onPress={() => onOptions(project)}
      />
    </ListItem>
  );
}

/** Such as "5 nov". */
function updatedOn(date: string): string {
  return new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const createStyles = (theme: Theme) => ({
  main: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.accentSoft,
  },
  text: { flex: 1, gap: 2 },
  title: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.sm },
  name: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});

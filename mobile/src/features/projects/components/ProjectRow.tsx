import { Pressable } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, IconButton, ListItem } from "@/shared/ui";

import type { Project } from "../api";

type Props = {
  project: Project;
  onOpen: (project: Project) => void;
  onOptions: (project: Project) => void;
};

export function ProjectRow({ project, onOpen, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <ListItem>
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
      <IconButton
        icon="options"
        label={`Opciones de ${project.name}`}
        onPress={() => onOptions(project)}
      />
    </ListItem>
  );
}

const createStyles = (theme: Theme) => ({
  main: { flex: 1, gap: theme.spacing.xs },
  pressed: { opacity: 0.6 },
});

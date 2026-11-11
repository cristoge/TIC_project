import { FlatList } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { EmptyState } from "@/shared/ui";

import type { Project } from "../api";
import { ProjectRow } from "./ProjectRow";

type Props = {
  projects: Project[];
  currentId: string | null;
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onOptions: (project: Project) => void;
};

export function ProjectList({ projects, currentId, onCreate, onOpen, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <FlatList
      data={projects}
      keyExtractor={(project) => project.id}
      renderItem={({ item }) => (
        <ProjectRow
          project={item}
          current={item.id === currentId}
          onOpen={onOpen}
          onOptions={onOptions}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="project"
          title="Aún no tienes proyectos"
          message="Crea uno para subir tus PDFs y empezar a estudiar."
          action={{ label: "Crear proyecto", onPress: onCreate }}
        />
      }
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const createStyles = (theme: Theme) => ({
  list: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
});

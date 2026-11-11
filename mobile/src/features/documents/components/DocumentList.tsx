import { FlatList } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { EmptyState, FLOATING_BUTTON_SPACE } from "@/shared/ui";

import type { Document } from "../api";
import { DocumentRow } from "./DocumentRow";

type Props = {
  documents: Document[];
  onOptions: (document: Document) => void;
};

export function DocumentList({ documents, onOptions }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <FlatList
      data={documents}
      keyExtractor={(document) => document.id}
      renderItem={({ item }) => <DocumentRow document={item} onOptions={onOptions} />}
      ListEmptyComponent={
        <EmptyState
          icon="documents"
          title="Aún no hay documentos"
          message="Sube un PDF para poder chatear y estudiar con él."
        />
      }
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const createStyles = (theme: Theme) => ({
  list: { flex: 1 },
  content: { paddingBottom: FLOATING_BUTTON_SPACE },
});

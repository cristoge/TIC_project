import { Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Badge, IconButton, ListItem } from "@/shared/ui";

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
    <ListItem>
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
      <IconButton
        icon="options"
        label={`Opciones de ${document.name}`}
        onPress={() => onOptions(document)}
      />
    </ListItem>
  );
}

const createStyles = (theme: Theme) => ({
  main: { flex: 1, gap: theme.spacing.xs },
  status: { gap: theme.spacing.xs, paddingTop: theme.spacing.xs },
  pressed: { opacity: 0.6 },
});

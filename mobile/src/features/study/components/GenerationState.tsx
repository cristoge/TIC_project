import { ActivityIndicator, View } from "react-native";

import { useTheme, useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, ErrorState } from "@/shared/ui";

type Query = {
  data?: { status: "pending" | "ready" | "failed"; error_message: string | null };
  isPending: boolean;
  error: Error | null;
  refetch: () => unknown;
};

type Props = {
  query: Query;
  /** Such as "Generando las flashcards…". */
  pendingText: string;
  /** Such as "No se pudieron generar las flashcards". */
  failedText: string;
};

/** What a study screen shows until its deck or quiz is ready; null once it is. */
export function GenerationState({ query, pendingText, failedText }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data } = query;

  if (data?.status === "ready") return null;
  if (data?.status === "pending") {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={theme.colors.textMuted} />
        <AppText color="textMuted">{pendingText}</AppText>
      </View>
    );
  }
  if (data) {
    return (
      <View style={styles.state}>
        <AppText variant="label" color="danger">
          {failedText}
        </AppText>
        {data.error_message ? <AppText color="textMuted">{data.error_message}</AppText> : null}
      </View>
    );
  }
  if (query.isPending) return <ActivityIndicator color={theme.colors.textMuted} />;
  return (
    <ErrorState
      message={query.error?.message ?? ""}
      onRetry={() => {
        query.refetch();
      }}
    />
  );
}

const createStyles = (theme: Theme) => ({
  state: { alignItems: "center" as const, gap: theme.spacing.sm, paddingTop: theme.spacing.xl },
});

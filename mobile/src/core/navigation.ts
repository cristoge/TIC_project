import { useMemo } from "react";

import { fonts, useTheme } from "@/shared/theme";

/** Themed header and background shared by the root stack and the nested group stacks. */
export function useStackScreenOptions() {
  const theme = useTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontFamily: fonts.semibold },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: theme.colors.background },
    }),
    [theme],
  );
}

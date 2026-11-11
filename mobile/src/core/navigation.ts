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
      // Only the arrow: iOS would otherwise show the previous screen's title, such as a route name.
      headerBackButtonDisplayMode: "minimal" as const,
      contentStyle: { backgroundColor: theme.colors.background },
    }),
    [theme],
  );
}

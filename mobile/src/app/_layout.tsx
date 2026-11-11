import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from "@expo-google-fonts/geist";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";

import { useStackScreenOptions } from "@/core/navigation";
import { useSession } from "@/features/auth";
import { createQueryClient } from "@/shared/api";
import { useTheme, useThemePreference } from "@/shared/theme";

SplashScreen.preventAutoHideAsync();

// react-native-drawer-layout (the side menu, bundled with expo-router) passes dependency lists to
// Reanimated hooks, which Reanimated 4 ignores on native and warns about once in development. The
// menu works the same; drop this when the library stops passing them.
LogBox.ignoreLogs(["[Reanimated] Dependencies should only be used on the web"]);

export default function RootLayout() {
  const theme = useTheme();
  const screenOptions = useStackScreenOptions();
  const [queryClient] = useState(createQueryClient);
  const status = useSession((state) => state.status);
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  // A font that fails to load falls back to the system font instead of blocking the app.
  const fontsReady = loaded || error !== null;
  // Waiting for the saved theme keeps the first screen from flashing in the other scheme.
  const [themeRestored, setThemeRestored] = useState(false);
  const ready = fontsReady && status !== "restoring" && themeRestored;
  const signedIn = status === "signedIn";

  useEffect(() => {
    useSession.getState().restore();
    useThemePreference
      .getState()
      .restore()
      .finally(() => setThemeRestored(true));
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // One session's cached server data must never show in the next one.
  useEffect(() => {
    if (status === "signedOut") queryClient.clear();
  }, [status, queryClient]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={screenOptions}>
        {/* Each guard names its fallback: without it a signed-out "/" has no route to match. */}
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

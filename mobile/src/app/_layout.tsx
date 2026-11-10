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

import { useStackScreenOptions } from "@/core/navigation";
import { useSession } from "@/features/auth";
import { createQueryClient } from "@/shared/api";
import { useTheme } from "@/shared/theme";

SplashScreen.preventAutoHideAsync();

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
  const ready = fontsReady && status !== "restoring";
  const signedIn = status === "signedIn";

  useEffect(() => {
    useSession.getState().restore();
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
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

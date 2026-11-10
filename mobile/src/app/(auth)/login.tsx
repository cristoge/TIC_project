import { Stack } from "expo-router";

import { LoginScreen } from "@/features/auth";

export default function Login() {
  return (
    <>
      <Stack.Screen options={{ title: "Iniciar sesión" }} />
      <LoginScreen />
    </>
  );
}

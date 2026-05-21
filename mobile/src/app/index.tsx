import { useEffect } from "react";
import { router } from "expo-router";

export default function Index() {
  const user = "cristo";

  useEffect(() => {
    if (user) {
      router.replace("/(app)/home");
    } else {
      router.replace("/(auth)/login");
    }
  }, []);

  return null;
}

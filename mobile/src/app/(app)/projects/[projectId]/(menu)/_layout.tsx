import { useLocalSearchParams, useRouter } from "expo-router";
import { Drawer, type DrawerContentComponentProps } from "expo-router/drawer";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProjectMenu, type MenuSection } from "@/core/ProjectMenu";
import { useLastProject } from "@/features/projects";
import { fonts, useTheme } from "@/shared/theme";
import { IconButton } from "@/shared/ui";

const SECTION_ROUTES: Record<string, MenuSection> = {
  "chats/index": "chats",
  documents: "documents",
  study: "study",
};

export default function ProjectMenuLayout() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    useLastProject.getState().remember(projectId);
  }, [projectId]);

  function menu({ state, navigation }: DrawerContentComponentProps) {
    const route = state.routes[state.index];
    const conversationId = (route.params as { conversationId?: string } | undefined)
      ?.conversationId;
    const active =
      SECTION_ROUTES[route.name] ??
      (conversationId && conversationId !== "new" ? { conversationId } : null);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ProjectMenu
          projectId={projectId}
          active={active}
          onNavigate={(href) => {
            navigation.closeDrawer();
            // The projects list and settings open on top; the project's own screens swap in place.
            if (String(href).startsWith(`/projects/${projectId}/`)) router.navigate(href);
            else router.push(href);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <Drawer
      drawerContent={menu}
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        drawerStyle: { backgroundColor: theme.colors.surface, width: 300 },
        headerLeft: () => (
          <View style={{ paddingLeft: theme.spacing.sm }}>
            <IconButton icon="menu" label="Abrir menú" onPress={() => navigation.toggleDrawer()} />
          </View>
        ),
      })}
    >
      <Drawer.Screen name="index" options={{ title: "Chat" }} />
      <Drawer.Screen name="chats/[conversationId]" options={{ title: "Chat" }} />
      <Drawer.Screen name="chats/index" options={{ title: "Chats" }} />
      <Drawer.Screen name="documents" options={{ title: "Documentos" }} />
      <Drawer.Screen name="study" options={{ title: "Estudio" }} />
    </Drawer>
  );
}

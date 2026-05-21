import { Drawer } from "expo-router/drawer";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../store/authStore";

const projects = [
  { id: "1", name: "Chat LLM App" },
  { id: "2", name: "Documentos IA" },
  { id: "3", name: "Dashboard" },
];

function CustomDrawerContent() {
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>

      {/* HEADER */}
      <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 20 }}>
        Proyectos
      </Text>

      {/* LISTA */}
      {projects.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/project/${p.id}`)}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>
            {p.name}
          </Text>
        </Pressable>
      ))}

      {/* FOOTER */}
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 40, gap: 8 }}>
        <Pressable
          onPress={() => router.push("/(app)/settings")}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: "#f3f4f6",
          }}
        >
          <Text style={{ fontSize: 16, color: "#374151", fontWeight: "600" }}>
            Ajustes
          </Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: "#fee2e2",
          }}
        >
          <Text style={{ fontSize: 16, color: "#dc2626", fontWeight: "600" }}>
            Cerrar sesión
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Layout() {
  return (
    <Drawer
      drawerContent={() => <CustomDrawerContent />}
      screenOptions={{
        drawerStyle: {
          width: 280, // 👈 evita que ocupe media pantalla
        },
        overlayColor: "rgba(0,0,0,0.4)",
      }}
    >
      <Drawer.Screen name="home" options={{ title: "Home" }} />
      <Drawer.Screen name="settings" options={{ title: "Ajustes" }} />
    </Drawer>
  );
}

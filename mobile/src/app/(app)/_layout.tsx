import { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { getUserDocuments, Document } from "../../services/documents";

function CustomDrawerContent() {
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.userId);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserDocuments(userId!)
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>

      <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 20 }}>
        Documentos
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : documents.length === 0 ? (
        <Text style={{ color: "#9ca3af", fontSize: 14 }}>Sin documentos</Text>
      ) : (
        documents.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => {
              router.push({
                pathname: "/(app)/document/[id]",
                params: { id: d.id, nombre: d.nombre },
              });
            }}
            style={{ paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 }}
          >
            <Text style={{ fontSize: 16 }}>{d.nombre}</Text>
          </Pressable>
        ))
      )}

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
        drawerStyle: { width: 280 },
        overlayColor: "rgba(0,0,0,0.4)",
      }}
    >
      <Drawer.Screen name="home" options={{ title: "Home" }} />
      <Drawer.Screen name="settings" options={{ title: "Ajustes" }} />
      <Drawer.Screen name="proyects" options={{ title: "Proyectos" }} />
      <Drawer.Screen name="project/[id]" options={{ title: "Proyecto", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="document/[id]" options={{ title: "Documento", drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}

import { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import { View, Text, Pressable, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { getUserDocuments, deleteDocument, Document } from "../../services/documents";

function CustomDrawerContent() {
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.userId);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Document | null>(null);

  useEffect(() => {
    getUserDocuments(userId!)
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    router.replace("/(auth)/login");
  }

  async function handleDelete() {
    if (!selected) return;
    await deleteDocument(selected.id);
    setDocuments((prev) => prev.filter((d) => d.id !== selected.id));
    setSelected(null);
  }

  return (
    <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>

      <Pressable
        onPress={() => router.push({ pathname: "/(app)/home", params: { newChat: Date.now() } })}
        style={{ paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginBottom: 8 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#2563eb" }}>Nuevo chat</Text>
      </Pressable>

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
            onLongPress={() => setSelected(d)}
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

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <View style={styles.sheet}>
            <Text style={styles.docName} numberOfLines={1}>{selected?.nombre}</Text>
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSelected(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  docName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  deleteBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  cancelBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    color: "#374151",
  },
});

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

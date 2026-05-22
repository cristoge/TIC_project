import { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import {
  View, Text, Pressable, ActivityIndicator, Modal,
  StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { getUserDocuments, deleteDocument, renameDocument, Document } from "../../services/documents";


function CustomDrawerContent() {
  const userId = useAuthStore((s) => s.userId);

  const [recientes, setRecientes] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Document | null>(null);
  const [renamingDoc, setRenamingDoc] = useState(false);
  const [renameDocValue, setRenameDocValue] = useState('');

  useEffect(() => {
    getUserDocuments(userId!)
      .then(setRecientes)
      .finally(() => setLoading(false));
  }, []);

  async function handleDeleteDoc() {
    if (!selected) return;
    await deleteDocument(selected.id);
    setRecientes((prev) => prev.filter((d) => d.id !== selected.id));
    setSelected(null);
  }

  async function handleRenameDoc() {
    if (!selected || !renameDocValue.trim()) return;
    await renameDocument(selected.id, renameDocValue.trim());
    const newName = renameDocValue.trim();
    setRecientes((prev) => prev.map((d) => d.id === selected.id ? { ...d, nombre: newName } : d));
    setSelected(null);
    setRenamingDoc(false);
  }

  return (
    <View style={{ flex: 1, paddingTop: 60 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>

        {/* Nuevo chat */}
        <Pressable
          onPress={() => router.push({ pathname: "/(app)/home", params: { newChat: Date.now() } })}
          style={styles.newChat}
        >
          <Ionicons name="create-outline" size={20} color="#2563eb" />
          <Text style={styles.newChatText}>Nuevo chat</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Proyectos — navega a la pantalla de proyectos */}
        <Pressable
          onPress={() => router.push("/(app)/proyects")}
          style={styles.navItem}
        >
          <Ionicons name="folder-outline" size={22} color="#2563eb" />
          <Text style={styles.navItemText}>Proyectos</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </Pressable>

        <View style={styles.divider} />

        {/* Recientes */}
        <Text style={styles.sectionTitle}>Recientes</Text>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 8 }} />
        ) : recientes.length === 0 ? (
          <Text style={styles.empty}>Sin documentos</Text>
        ) : (
          recientes.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: "/(app)/document/[id]", params: { id: d.id, nombre: d.nombre } })}
              onLongPress={() => setSelected(d)}
              style={styles.docRow}
            >
              <Text style={styles.docText} numberOfLines={1}>{d.nombre}</Text>
            </Pressable>
          ))
        )}

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.push("/(app)/settings")} style={styles.footerBtn}>
          <Ionicons name="settings-outline" size={22} color="#6b7280" />
        </Pressable>
      </View>

      {/* Modal documento */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => { setSelected(null); setRenamingDoc(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSelected(null); setRenamingDoc(false); }} />
          <View style={styles.sheet}>
            <Text style={styles.sheetDocName} numberOfLines={1}>{selected?.nombre}</Text>
            {renamingDoc ? (
              <>
                <TextInput
                  style={styles.input}
                  value={renameDocValue}
                  onChangeText={setRenameDocValue}
                  placeholder="Nuevo nombre"
                  autoFocus
                />
                <Pressable style={[styles.createBtn, !renameDocValue.trim() && styles.createBtnDisabled]} onPress={handleRenameDoc} disabled={!renameDocValue.trim()}>
                  <Text style={styles.createBtnText}>Guardar</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setRenamingDoc(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.renameBtn} onPress={() => { setRenameDocValue(selected?.nombre ?? ''); setRenamingDoc(true); }}>
                  <Text style={styles.renameBtnText}>Renombrar</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={handleDeleteDoc}>
                  <Text style={styles.deleteText}>Eliminar</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  newChat: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  newChatText: { fontSize: 16, fontWeight: "600", color: "#2563eb" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    gap: 10,
  },
  navItemText: { flex: 1, fontSize: 16, fontWeight: "600", color: "#111827" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
  docRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 },
  docText: { fontSize: 14, color: "#374151" },
  empty: { fontSize: 13, color: "#9ca3af", paddingVertical: 4 },
  footer: { paddingHorizontal: 20, paddingBottom: 40 },
  footerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  sheet: { backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "100%", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  sheetDocName: { fontSize: 15, fontWeight: "600", color: "#374151", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  renameBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: "#eff6ff", alignItems: "center" },
  renameBtnText: { fontSize: 15, fontWeight: "600", color: "#2563eb" },
  deleteBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: "#dc2626", alignItems: "center" },
  deleteText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  createBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: "#2563eb", alignItems: "center" },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  cancelBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: "#f3f4f6", alignItems: "center" },
  cancelText: { fontSize: 15, color: "#374151" },
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

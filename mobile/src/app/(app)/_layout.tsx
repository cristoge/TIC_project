import { useEffect, useState } from "react";
import { Drawer } from "expo-router/drawer";
import {
  View, Text, Pressable, ActivityIndicator, Modal,
  StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import * as DocumentPicker from 'expo-document-picker';
import { getUserDocuments, deleteDocument, renameDocument, uploadDocument, getDocuments, Document } from "../../services/documents";
import { getProjects, createProject, deleteProject, renameProject, Project } from "../../services/projects";

function CustomDrawerContent() {
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.userId);

  const [recientes, setRecientes] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [projectDocs, setProjectDocs] = useState<Record<string, Document[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<Record<string, boolean>>({});

  const [selected, setSelected] = useState<Document | null>(null);
  const [renamingDoc, setRenamingDoc] = useState(false);
  const [renameDocValue, setRenameDocValue] = useState('');

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameProjectValue, setRenameProjectValue] = useState('');

  const [uploadingProject, setUploadingProject] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ projectId: string; uri: string; fileName: string } | null>(null);
  const [uploadNombre, setUploadNombre] = useState('');

  const [showNewProject, setShowNewProject] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    Promise.all([
      getUserDocuments(userId!),
      getProjects(userId!),
    ]).then(([docs, projs]) => {
      setRecientes(docs);
      setProjects(projs);
    }).finally(() => setLoading(false));
  }, []);

  async function toggleProject(projectId: string) {
    const isOpen = expanded[projectId];
    setExpanded((prev) => ({ ...prev, [projectId]: !isOpen }));

    if (!isOpen && !projectDocs[projectId]) {
      setLoadingDocs((prev) => ({ ...prev, [projectId]: true }));
      const docs = await getDocuments(projectId).catch(() => [] as Document[]);
      setProjectDocs((prev) => ({ ...prev, [projectId]: docs }));
      setLoadingDocs((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  async function handleDeleteProject() {
    if (!selectedProject) return;
    await deleteProject(selectedProject.id);
    setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
    setSelectedProject(null);
  }

  async function handleUploadDocument(projectId: string) {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    const file = result.assets[0];
    setPendingUpload({ projectId, uri: file.uri, fileName: file.name });
    setUploadNombre(file.name.replace(/\.pdf$/i, ''));
  }

  async function confirmUpload() {
    if (!pendingUpload || !uploadNombre.trim()) return;
    const { projectId, uri } = pendingUpload;
    const nombre = uploadNombre.trim().endsWith('.pdf')
      ? uploadNombre.trim()
      : uploadNombre.trim() + '.pdf';

    setPendingUpload(null);
    setUploadingProject(projectId);
    try {
      await uploadDocument(projectId, uri, nombre);
      const [docs, all] = await Promise.all([
        getDocuments(projectId),
        getUserDocuments(userId!),
      ]);
      setProjectDocs((prev) => ({ ...prev, [projectId]: docs }));
      setRecientes(all);
    } finally {
      setUploadingProject(null);
    }
  }

  async function handleRenameProject() {
    if (!selectedProject || !renameProjectValue.trim()) return;
    await renameProject(selectedProject.id, renameProjectValue.trim());
    setProjects((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, nombre: renameProjectValue.trim() } : p));
    setSelectedProject(null);
    setRenamingProject(false);
  }

  async function handleDeleteDoc() {
    if (!selected) return;
    await deleteDocument(selected.id);
    setRecientes((prev) => prev.filter((d) => d.id !== selected.id));
    setProjectDocs((prev) => {
      const updated = { ...prev };
      for (const pid in updated) {
        updated[pid] = updated[pid].filter((d) => d.id !== selected.id);
      }
      return updated;
    });
    setSelected(null);
  }

  async function handleRenameDoc() {
    if (!selected || !renameDocValue.trim()) return;
    await renameDocument(selected.id, renameDocValue.trim());
    const newName = renameDocValue.trim();
    setRecientes((prev) => prev.map((d) => d.id === selected.id ? { ...d, nombre: newName } : d));
    setProjectDocs((prev) => {
      const updated = { ...prev };
      for (const pid in updated) {
        updated[pid] = updated[pid].map((d) => d.id === selected.id ? { ...d, nombre: newName } : d);
      }
      return updated;
    });
    setSelected(null);
    setRenamingDoc(false);
  }

  async function handleCreateProject() {
    if (!newNombre.trim()) return;
    setSavingProject(true);
    try {
      await createProject(userId!, newNombre.trim(), newDesc.trim());
      const projs = await getProjects(userId!);
      setProjects(projs);
      setShowNewProject(false);
      setNewNombre('');
      setNewDesc('');
    } finally {
      setSavingProject(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={{ flex: 1, paddingTop: 60 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>

        {/* Nuevo chat */}
        <Pressable
          onPress={() => router.push({ pathname: "/(app)/home", params: { newChat: Date.now() } })}
          style={styles.newChat}
        >
          <Text style={styles.newChatText}>Nuevo chat</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Proyectos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Proyectos</Text>
          <Pressable onPress={() => { setNewNombre(''); setNewDesc(''); setShowNewProject(true); }} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 8 }} />
        ) : projects.length === 0 ? (
          <Text style={styles.empty}>Sin proyectos</Text>
        ) : (
          projects.map((p) => (
            <View key={p.id}>
              <Pressable onPress={() => toggleProject(p.id)} onLongPress={() => setSelectedProject(p)} style={styles.projectRow}>
                <Text style={styles.chevron}>{expanded[p.id] ? '▾' : '▸'}</Text>
                <Text style={styles.projectName}>{p.nombre}</Text>
              </Pressable>

              {expanded[p.id] && (
                <>
                  {loadingDocs[p.id] ? (
                    <ActivityIndicator style={{ marginLeft: 24, marginVertical: 4 }} />
                  ) : (projectDocs[p.id] ?? []).length === 0 ? (
                    <Text style={styles.emptyDocs}>Sin documentos</Text>
                  ) : (
                    (projectDocs[p.id] ?? []).map((d) => (
                      <Pressable
                        key={d.id}
                        onPress={() => router.push({ pathname: "/(app)/document/[id]", params: { id: d.id, nombre: d.nombre } })}
                        onLongPress={() => setSelected(d)}
                        style={styles.docRowIndented}
                      >
                        <Text style={styles.docText} numberOfLines={1}>{d.nombre}</Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    onPress={() => handleUploadDocument(p.id)}
                    disabled={uploadingProject === p.id}
                    style={styles.addDocBtn}
                  >
                    {uploadingProject === p.id
                      ? <ActivityIndicator size="small" color="#2563eb" />
                      : <Text style={styles.addDocText}>+ Añadir documento</Text>
                    }
                  </Pressable>
                </>
              )}
            </View>
          ))
        )}

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

      {/* Ajustes y logout */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.push("/(app)/settings")} style={styles.footerBtn}>
          <Text style={styles.footerBtnText}>Ajustes</Text>
        </Pressable>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
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

      {/* Modal proyecto */}
      <Modal visible={!!selectedProject} transparent animationType="fade" onRequestClose={() => { setSelectedProject(null); setRenamingProject(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSelectedProject(null); setRenamingProject(false); }} />
          <View style={styles.sheet}>
            <Text style={styles.sheetDocName} numberOfLines={1}>{selectedProject?.nombre}</Text>
            {renamingProject ? (
              <>
                <TextInput
                  style={styles.input}
                  value={renameProjectValue}
                  onChangeText={setRenameProjectValue}
                  placeholder="Nuevo nombre"
                  autoFocus
                />
                <Pressable style={[styles.createBtn, !renameProjectValue.trim() && styles.createBtnDisabled]} onPress={handleRenameProject} disabled={!renameProjectValue.trim()}>
                  <Text style={styles.createBtnText}>Guardar</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setRenamingProject(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.renameBtn} onPress={() => { setRenameProjectValue(selectedProject?.nombre ?? ''); setRenamingProject(true); }}>
                  <Text style={styles.renameBtnText}>Renombrar</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={handleDeleteProject}>
                  <Text style={styles.deleteText}>Eliminar proyecto</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setSelectedProject(null)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal nombre documento */}
      <Modal visible={!!pendingUpload} transparent animationType="fade" onRequestClose={() => setPendingUpload(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPendingUpload(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Nombre del documento</Text>
            <TextInput
              style={styles.input}
              value={uploadNombre}
              onChangeText={setUploadNombre}
              placeholder="Nombre *"
              autoFocus
            />
            <Pressable
              style={[styles.createBtn, !uploadNombre.trim() && styles.createBtnDisabled]}
              onPress={confirmUpload}
              disabled={!uploadNombre.trim()}
            >
              <Text style={styles.createBtnText}>Subir</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setPendingUpload(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal nuevo proyecto */}
      <Modal visible={showNewProject} transparent animationType="fade" onRequestClose={() => setShowNewProject(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowNewProject(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Nuevo proyecto</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              value={newNombre}
              onChangeText={setNewNombre}
              editable={!savingProject}
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Descripción"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              editable={!savingProject}
            />
            <Pressable
              style={[styles.createBtn, (!newNombre.trim() || savingProject) && styles.createBtnDisabled]}
              onPress={handleCreateProject}
              disabled={!newNombre.trim() || savingProject}
            >
              {savingProject
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Crear</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setShowNewProject(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  newChat: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  newChatText: { fontSize: 16, fontWeight: "600", color: "#2563eb" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase" },
  addBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#e5e7eb", justifyContent: "center", alignItems: "center" },
  addBtnText: { fontSize: 18, color: "#374151", lineHeight: 22 },
  projectRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8 },
  chevron: { fontSize: 12, color: "#6b7280", marginRight: 8 },
  projectName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  docRowIndented: { paddingVertical: 7, paddingLeft: 28, paddingRight: 4, borderRadius: 8 },
  docRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 },
  docText: { fontSize: 14, color: "#374151" },
  empty: { fontSize: 13, color: "#9ca3af", paddingVertical: 4 },
  emptyDocs: { fontSize: 13, color: "#9ca3af", paddingLeft: 28, paddingVertical: 4 },
  addDocBtn: { paddingVertical: 7, paddingLeft: 28, paddingRight: 4 },
  addDocText: { fontSize: 13, color: "#2563eb" },
  footer: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  footerBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#f3f4f6" },
  footerBtnText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  logoutBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#fee2e2" },
  logoutText: { fontSize: 16, color: "#dc2626", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  sheet: { backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "100%", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  sheetDocName: { fontSize: 15, fontWeight: "600", color: "#374151", textAlign: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
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

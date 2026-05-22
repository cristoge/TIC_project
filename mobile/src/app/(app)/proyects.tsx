import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { getProjects, createProject, deleteProject, Project } from '../../services/projects'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - 48) / 2

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hace 1 día'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months === 1) return 'hace 1 mes'
  return `hace ${months} meses`
}

export default function Projects() {
  const userId = useAuthStore((s) => s.userId)
  const accentColor = useThemeStore((s) => s.accentColor)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchProjects() {
    try {
      const data = await getProjects(userId!)
      setProjects(data)
    } catch {
      setError('No se pudieron cargar los proyectos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  async function handleDelete() {
    if (!selectedProject) return
    setDeleting(true)
    try {
      await deleteProject(selectedProject.id)
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id))
      setSelectedProject(null)
    } finally {
      setDeleting(false)
    }
  }

  function openModal() {
    setNombre('')
    setDescripcion('')
    setFormError(null)
    setModalVisible(true)
  }

  async function handleCreate() {
    if (!nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await createProject(userId!, nombre.trim(), descripcion.trim())
      setModalVisible(false)
      setLoading(true)
      await fetchProjects()
    } catch {
      setFormError('Error al crear el proyecto')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="folder-open-outline" size={72} color="#d1d5db" />
            <Text style={styles.emptyText}>No tienes proyectos todavía</Text>
            <Text style={styles.emptyHint}>Toca + para crear uno</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              router.push({
                pathname: '/(app)/project/[id]',
                params: { id: item.id, nombre: item.nombre },
              })
            }
            onLongPress={() => setSelectedProject(item)}
          >
            <Ionicons name="folder-outline" size={40} color={accentColor} />
            <Text style={styles.cardTitle} numberOfLines={2}>{item.nombre}</Text>
            {item.created_at ? (
              <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
            ) : null}
          </Pressable>
        )}
      />

      <Pressable style={[styles.fab, { backgroundColor: accentColor }]} onPress={openModal}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <Text style={styles.sheetTitle}>Nuevo proyecto</Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre *"
            placeholderTextColor="#9ca3af"
            value={nombre}
            onChangeText={setNombre}
            editable={!saving}
          />
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Descripción"
            placeholderTextColor="#9ca3af"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            editable={!saving}
          />

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          <Pressable
            style={[styles.button, { backgroundColor: accentColor }, saving && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Crear</Text>}

          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal borrar proyecto */}
      <Modal visible={!!selectedProject} transparent animationType="fade" onRequestClose={() => setSelectedProject(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedProject(null)}>
          <View style={styles.deleteSheet}>
            <Text style={styles.deleteTitle} numberOfLines={1}>{selectedProject?.nombre}</Text>
            <Pressable
              style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteBtnText}>Eliminar proyecto</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSelectedProject(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  grid: { padding: 16, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: {
    width: CARD_SIZE,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
    minHeight: 120,
  },
  cardPressed: { opacity: 0.7 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flexShrink: 1 },
  cardTime: { fontSize: 12, color: '#9ca3af' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#6b7280', fontWeight: '500', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#9ca3af' },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 8 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4, color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  deleteSheet: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', gap: 12 },
  deleteTitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  deleteBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#374151' },
})

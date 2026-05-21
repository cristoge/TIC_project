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
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { getProjects, createProject, Project } from '../../services/projects'

export default function Projects() {
  const userId = useAuthStore((s) => s.userId)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
    return <View style={styles.center}><ActivityIndicator size="large" /></View>
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No tienes proyectos todavía</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/(app)/project/[id]',
                params: { id: item.id, nombre: item.nombre },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.nombre}</Text>
            {item.descripcion ? (
              <Text style={styles.cardDesc}>{item.descripcion}</Text>
            ) : null}
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+</Text>
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
            value={nombre}
            onChangeText={setNombre}
            editable={!saving}
          />
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            editable={!saving}
          />

          {formError && <Text style={styles.error}>{formError}</Text>}

          <Pressable
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Crear</Text>
            }
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardDesc: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  error: { color: '#ef4444', fontSize: 14, marginBottom: 8 },
  empty: { color: '#9ca3af', fontSize: 15 },
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
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
})

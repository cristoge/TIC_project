import { useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useThemeStore } from '../../../store/themeStore'
import { getDocuments, uploadDocument, deleteDocument, Document } from '../../../services/documents'

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string; nombre: string }>()
  const accentColor = useThemeStore((s) => s.accentColor)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pendingUpload, setPendingUpload] = useState<{ uri: string; fileName: string } | null>(null)
  const [uploadNombre, setUploadNombre] = useState('')
  const [uploading, setUploading] = useState(false)

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const docs = await getDocuments(id!).catch(() => null)
      if (!docs) return
      setDocuments(docs)
      const stillProcessing = docs.some((d) => d.processing_status === 'processing')
      if (!stillProcessing) stopPolling()
    }, 3000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    setLoading(true)
    setDocuments([])
    setError(null)
    getDocuments(id!)
      .then((docs) => {
        setDocuments(docs)
        if (docs.some((d) => d.processing_status === 'processing')) startPolling()
      })
      .catch(() => setError('No se pudieron cargar los documentos'))
      .finally(() => setLoading(false))
    return () => stopPolling()
  }, [id])

  async function handlePickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (result.canceled) return
    const file = result.assets[0]
    setPendingUpload({ uri: file.uri, fileName: file.name })
    setUploadNombre(file.name.replace(/\.pdf$/i, ''))
  }

  async function handleDelete() {
    if (!selectedDoc) return
    setDeleting(true)
    try {
      await deleteDocument(selectedDoc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== selectedDoc.id))
      setSelectedDoc(null)
    } finally {
      setDeleting(false)
    }
  }

  async function confirmUpload() {
    if (!pendingUpload || !uploadNombre.trim()) return
    const nombre = uploadNombre.trim().endsWith('.pdf')
      ? uploadNombre.trim()
      : uploadNombre.trim() + '.pdf'
    const uri = pendingUpload.uri
    setPendingUpload(null)
    setUploading(true)
    try {
      await uploadDocument(id!, uri, nombre)
      const docs = await getDocuments(id!)
      setDocuments(docs)
      startPolling()
    } finally {
      setUploading(false)
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
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyText}>Este proyecto no tiene documentos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() =>
              router.push({
                pathname: '/(app)/document/[id]',
                params: { id: item.id, nombre: item.nombre },
              })
            }
            onLongPress={() => setSelectedDoc(item)}
          >
            <Ionicons name="document-text-outline" size={24} color={accentColor} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.nombre}</Text>
              {item.processing_status === 'processing' && (
                <Text style={styles.rowStatus}>Procesando...</Text>
              )}
            </View>
            {item.processing_status === 'processing' && (
              <ActivityIndicator size="small" color="#9ca3af" />
            )}
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB subir documento */}
      <Pressable style={[styles.fab, { backgroundColor: accentColor }]} onPress={handlePickDocument} disabled={uploading}>
        {uploading
          ? <ActivityIndicator color="#fff" />
          : <Ionicons name="add" size={30} color="#fff" />
        }
      </Pressable>

      {/* Modal borrar documento */}
      <Modal visible={!!selectedDoc} transparent animationType="fade" onRequestClose={() => setSelectedDoc(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedDoc(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{selectedDoc?.nombre}</Text>
            <Pressable
              style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteBtnText}>Eliminar documento</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSelectedDoc(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal nombre documento */}
      <Modal
        visible={!!pendingUpload}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingUpload(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
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
              style={[styles.confirmBtn, { backgroundColor: accentColor }, !uploadNombre.trim() && styles.confirmBtnDisabled]}
              onPress={confirmUpload}
              disabled={!uploadNombre.trim()}
            >
              <Text style={styles.confirmBtnText}>Subir</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setPendingUpload(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, paddingBottom: 100, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 12,
  },
  rowPressed: { opacity: 0.6 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: '#111827' },
  rowStatus: { fontSize: 12, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' },
  separator: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 44 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#6b7280', marginTop: 12 },
  errorText: { color: '#ef4444', fontSize: 15 },
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151' },
  deleteBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})

import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getDocuments, Document } from '../../../services/documents'

export default function ProjectDetail() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocuments(id!)
      .then(setDocuments)
      .catch(() => setError('No se pudieron cargar los documentos'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  }

  return (
    <FlatList
      data={documents}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.empty}>Este proyecto no tiene documentos</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: '/(app)/document/[id]',
              params: { id: item.id, nombre: item.nombre },
            })
          }
        >
          <Text style={styles.cardTitle}>{item.nombre}</Text>
          <Text style={styles.cardStatus}>{item.processing_status}</Text>
        </Pressable>
      )}
    />
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
  cardStatus: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  error: { color: '#ef4444', fontSize: 15 },
  empty: { color: '#9ca3af', fontSize: 15 },
})

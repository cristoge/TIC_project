import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Chat from '../../../components/Chat'
import { ChatMessage } from '../../../services/simpleChat'
import { getDocumentHistory, streamDocumentChat } from '../../../services/documentChat'

export default function DocumentChat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | null>(null)

  useEffect(() => {
    setInitialMessages(null)
    getDocumentHistory(id!)
      .then(setInitialMessages)
      .catch(() => setInitialMessages([]))
  }, [id])

  if (initialMessages === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <Chat
      key={id}
      initialMessages={initialMessages}
      onSend={(query, historial, onToken, onEnd) =>
        streamDocumentChat(query, historial, onToken, onEnd, id!)
      }
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})

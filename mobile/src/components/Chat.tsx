import React, { useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChatMessage } from '../services/simpleChat'
import { useThemeStore } from '../store/themeStore'

interface Props {
  onSend: (
    query: string,
    historial: ChatMessage[],
    onToken: (t: string) => void,
    onEnd: () => void
  ) => Promise<void>
  emptyState?: React.ReactNode
  initialMessages?: ChatMessage[]
}

export default function Chat({ onSend, emptyState, initialMessages }: Props) {
  const accentColor = useThemeStore((s) => s.accentColor)
  const { bottom } = useSafeAreaInsets()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const listRef = useRef<FlatList>(null)

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const historial = [...messages, userMsg]

    setMessages([...historial, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    await onSend(
      text,
      historial,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + token }
          return updated
        })
        listRef.current?.scrollToEnd({ animated: false })
      },
      () => setStreaming(false)
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={emptyState ? <>{emptyState}</> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.role === 'user'
              ? [styles.userBubble, { backgroundColor: accentColor }]
              : styles.aiBubble,
          ]}>
            <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>
              {item.content}
            </Text>
          </View>
        )}
      />

      <View style={[styles.inputRow, { paddingBottom: Math.max(bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#9ca3af"
          editable={!streaming}
          multiline
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: accentColor }, (streaming || !input.trim()) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={streaming || !input.trim()}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16, gap: 10 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  bubbleText: { fontSize: 15, color: '#111827', lineHeight: 22 },
  userText: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: { backgroundColor: '#d1d5db' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})

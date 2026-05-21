import { ChatMessage } from './simpleChat'
import { streamNDJSON } from './stream'

const API_URL = 'http://127.0.0.1:8000'

export async function getDocumentHistory(documentId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/chat/${documentId}/messages`)
  if (!res.ok) throw new Error('Error al cargar historial')
  const data = await res.json()
  return data.mensajes.map((m: { rol: string; contenido: string }) => ({
    role: m.rol as 'user' | 'assistant',
    content: m.contenido,
  }))
}

export function streamDocumentChat(
  query: string,
  _historial: ChatMessage[],
  onToken: (token: string) => void,
  onEnd: () => void,
  documentId: string
): Promise<void> {
  return streamNDJSON(
    `${API_URL}/chat/`,
    { query, document_id: documentId },
    {},
    onToken,
    onEnd
  )
}

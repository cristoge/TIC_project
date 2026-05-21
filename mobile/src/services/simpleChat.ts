import { streamNDJSON } from './stream'

const API_URL = 'http://127.0.0.1:8000'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function streamSimpleChat(
  query: string,
  historial: ChatMessage[],
  onToken: (token: string) => void,
  onEnd: () => void
): Promise<void> {
  return streamNDJSON(
    `${API_URL}/simple-chat/`,
    { query, historial },
    {},
    onToken,
    onEnd
  )
}

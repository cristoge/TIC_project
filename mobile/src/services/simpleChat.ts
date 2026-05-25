import { streamNDJSON } from './stream'

import { API_URL } from './config'

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

export function streamNDJSON(
  url: string,
  body: object,
  headers: Record<string, string>,
  onToken: (token: string) => void,
  onEnd: () => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)

    const allHeaders = { 'Content-Type': 'application/json', ...headers }
    Object.entries(allHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v))

    let offset = 0

    xhr.onprogress = () => {
      const newData = xhr.responseText.slice(offset)
      offset = xhr.responseText.length

      for (const line of newData.split('\n')) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'token') onToken(parsed.data)
          if (parsed.type === 'end') onEnd()
        } catch {}
      }
    }

    xhr.onload = () => resolve()
    xhr.onerror = () => reject(new Error('Error de red'))

    xhr.send(JSON.stringify(body))
  })
}

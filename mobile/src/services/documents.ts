const API_URL = 'http://127.0.0.1:8000'

export interface Document {
  id: string
  project_id: string
  nombre: string
  processing_status: string
}

export async function getDocuments(projectId: string): Promise<Document[]> {
  const res = await fetch(`${API_URL}/documents/${projectId}`)
  if (!res.ok) throw new Error('Error al cargar documentos')
  const data = await res.json()
  return data.documents
}

export async function getUserDocuments(userId: string): Promise<Document[]> {
  const res = await fetch(`${API_URL}/documents/user/${userId}`)
  if (!res.ok) throw new Error('Error al cargar documentos')
  const data = await res.json()
  return data.documents
}

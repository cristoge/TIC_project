import { API_URL } from './config'

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

export async function uploadDocument(projectId: string, fileUri: string, fileName: string): Promise<{ document_id: string }> {
  const formData = new FormData()
  formData.append('file', { uri: fileUri, name: fileName, type: 'application/pdf' } as any)

  const res = await fetch(`${API_URL}/documents/${projectId}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Error al subir el documento')
  return res.json()
}

export async function renameDocument(documentId: string, nombre: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al renombrar documento')
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar documento')
}

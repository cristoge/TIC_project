import { API_URL } from './config'

export interface Project {
  id: string
  nombre: string
  descripcion: string
  user_id: string
  created_at?: string
}

export async function getProjects(userId: string): Promise<Project[]> {
  const res = await fetch(`${API_URL}/projects/${userId}`)
  if (!res.ok) throw new Error('Error al cargar proyectos')
  const data = await res.json()
  return data.projects
}

export async function createProject(
  userId: string,
  nombre: string,
  descripcion: string
): Promise<string> {
  const res = await fetch(`${API_URL}/projects/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, nombre, descripcion }),
  })
  if (!res.ok) throw new Error('Error al crear proyecto')
  const data = await res.json()
  return data.project_id
}

export async function renameProject(projectId: string, nombre: string): Promise<void> {
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al renombrar proyecto')
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar proyecto')
}

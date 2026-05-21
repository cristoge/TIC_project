const API_URL = 'http://127.0.0.1:8000'

export interface Project {
  id: string
  nombre: string
  descripcion: string
  user_id: string
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

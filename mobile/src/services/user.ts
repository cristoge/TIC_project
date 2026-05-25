import { API_URL } from './config'

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function getMe(token: string): Promise<{ nombre: string; email: string }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Error al obtener perfil')
  return res.json()
}

export async function updateMe(token: string, nombre: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al actualizar perfil')
}

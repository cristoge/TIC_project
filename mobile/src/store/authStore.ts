import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { loginRequest } from '../services/auth'
import { getMe } from '../services/user'

interface AuthState {
  userId: string | null
  token: string | null
  nombre: string | null
  login: (email: string, password: string) => Promise<void>
  setNombre: (nombre: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      token: null,
      nombre: null,
      login: async (email, password) => {
        const data = await loginRequest(email, password)
        set({ userId: data.user_id, token: data.access_token })
        const profile = await getMe(data.access_token)
        set({ nombre: profile.nombre })
      },
      setNombre: (nombre) => set({ nombre }),
      logout: () => set({ userId: null, token: null, nombre: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

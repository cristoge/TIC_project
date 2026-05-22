import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ACCENT_COLORS = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#16a34a', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#e11d48', label: 'Rose' },
] as const

export type AccentColor = typeof ACCENT_COLORS[number]['value']

interface ThemeState {
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: '#2563eb',
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

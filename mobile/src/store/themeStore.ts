import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ACCENT_COLORS = [
  { hex: '#2563eb', label: 'Blue' },
  { hex: '#7c3aed', label: 'Purple' },
  { hex: '#16a34a', label: 'Green' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#e11d48', label: 'Rose' },
] as const

export type AccentColor = typeof ACCENT_COLORS[number]['hex']

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

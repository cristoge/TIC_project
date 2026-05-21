import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { useAuthStore } from '../store/authStore'

export default function Index() {
  const token = useAuthStore((s) => s.token)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (token) {
      router.replace('/(app)/home')
    } else {
      router.replace('/(auth)/login')
    }
  }, [hydrated, token])

  return null
}

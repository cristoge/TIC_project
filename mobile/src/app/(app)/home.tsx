import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import Chat from '../../components/Chat'
import { streamSimpleChat } from '../../services/simpleChat'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function Greeting() {
  const nombre = useAuthStore((s) => s.nombre)
  const accentColor = useThemeStore((s) => s.accentColor)
  const fullText = `${getGreeting()}${nombre ? `, ${nombre}` : ''} 👋`

  const [displayed, setDisplayed] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const indexRef = useRef(0)

  const avatarScale = useSharedValue(1)
  const avatarOpacity = useSharedValue(0)
  const textOpacity = useSharedValue(0)
  const subtextOpacity = useSharedValue(0)

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: avatarOpacity.value,
    transform: [{ scale: avatarScale.value }],
  }))
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }))
  const subtextStyle = useAnimatedStyle(() => ({ opacity: subtextOpacity.value }))

  useEffect(() => {
    avatarOpacity.value = withTiming(1, { duration: 500 })
    avatarScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    )
    const typeDelay = setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 300 })
      const interval = setInterval(() => {
        indexRef.current += 1
        setDisplayed(fullText.slice(0, indexRef.current))
        if (indexRef.current >= fullText.length) {
          clearInterval(interval)
          setTimeout(() => setShowCursor(false), 500)
        }
      }, 45)
      return () => clearInterval(interval)
    }, 400)
    subtextOpacity.value = withDelay(900, withTiming(1, { duration: 500 }))
    return () => clearTimeout(typeDelay)
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.avatarWrapper,
          { backgroundColor: `${accentColor}18` },
          avatarStyle,
        ]}
      >
        <Text style={[styles.avatarIcon, { color: accentColor }]}>✧</Text>
      </Animated.View>

      <Animated.View style={textStyle}>
        <Text style={styles.greeting}>
          {displayed}
          {showCursor && <Text style={[styles.cursor, { color: accentColor }]}>|</Text>}
        </Text>
      </Animated.View>

      <Animated.Text style={[styles.subtext, subtextStyle]}>
        ¿En qué puedo ayudarte hoy?
      </Animated.Text>
    </View>
  )
}

export default function Home() {
  const { newChat } = useLocalSearchParams<{ newChat: string }>()
  return (
    <Chat
      key={newChat ?? 'initial'}
      onSend={streamSimpleChat}
      emptyState={<Greeting />}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    gap: 8,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarIcon: {
    fontSize: 28,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  cursor: {
    opacity: 1,
  },
  subtext: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
})

import { View, Text, StyleSheet } from 'react-native'
import Chat from '../../components/Chat'
import { streamSimpleChat } from '../../services/simpleChat'
import { useAuthStore } from '../../store/authStore'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function Greeting() {
  const nombre = useAuthStore((s) => s.nombre)
  return (
    <View style={styles.greeting}>
      <Text style={styles.greetingText}>
        {getGreeting()}{nombre ? `, ${nombre}` : ''} 👋
      </Text>
      <Text style={styles.greetingSubtext}>
        Bienvenido a tu workspace
      </Text>
    </View>
  )
}

export default function Home() {
  return (
    <Chat onSend={streamSimpleChat} emptyState={<Greeting />} />
  )
}

const styles = StyleSheet.create({
  greeting: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '600',
  },
  greetingSubtext: {
    fontSize: 18,
    marginTop: 10,
    color: '#6b7280',
  },
})

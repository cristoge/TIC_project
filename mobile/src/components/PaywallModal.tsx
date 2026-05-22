import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore } from '../store/themeStore'

const FEATURES = [
  'Soporte para +30 lenguajes',
  'Detección de bugs con IA',
  'Documentación automática',
  'Búsqueda semántica en tu código',
  'Proyectos ilimitados',
]

interface Props {
  visible: boolean
  onClose: () => void
}

export default function PaywallModal({ visible, onClose }: Props) {
  const accentColor = useThemeStore((s) => s.accentColor)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={[styles.iconWrap, { backgroundColor: accentColor }]}>
          <Ionicons name="rocket-outline" size={36} color="#fff" />
        </View>

        <Text style={styles.title}>Upgrade a PRO</Text>
        <Text style={styles.subtitle}>
          Desbloquea todo el potencial de la app con acceso completo a todas las funciones.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceWrap}>
          <Text style={styles.price}>9,99€</Text>
          <Text style={styles.pricePer}> / mes</Text>
        </View>

        <Pressable style={[styles.btn, { backgroundColor: accentColor }]} onPress={onClose}>
          <Text style={styles.btnText}>Empezar prueba gratis</Text>
        </Pressable>
        <Text style={styles.trial}>7 días gratis, cancela cuando quieras</Text>

        <Pressable onPress={onClose}>
          <Text style={styles.cancel}>Ahora no</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21 },
  features: { width: '100%', gap: 10, marginVertical: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: '#374151' },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  price: { fontSize: 32, fontWeight: '800', color: '#111827' },
  pricePer: { fontSize: 16, color: '#6b7280' },
  btn: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  trial: { fontSize: 12, color: '#9ca3af' },
  cancel: { fontSize: 14, color: '#9ca3af', paddingVertical: 8 },
})

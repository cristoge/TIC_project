import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore, ACCENT_COLORS, AccentColor } from '../../store/themeStore'
import { getMe, updateMe } from '../../services/user'

function Row({
  icon,
  label,
  value,
  onPress,
  blue = false,
  red = false,
  last = false,
}: {
  icon: string
  label: string
  value?: string
  onPress?: () => void
  blue?: boolean
  red?: boolean
  last?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, last && styles.rowLast]}
      onPress={onPress}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={red ? '#dc2626' : blue ? '#2563eb' : '#6b7280'}
      />
      <Text style={[styles.rowLabel, red && styles.rowRed, blue && styles.rowBlue]}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  )
}

function Sep() {
  return <View style={styles.sep} />
}

export default function Settings() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const storeSetNombre = useAuthStore((s) => s.setNombre)
  const accentColor = useThemeStore((s) => s.accentColor)
  const setAccentColor = useThemeStore((s) => s.setAccentColor)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMe(token!)
      .then((data) => { setNombre(data.nombre); setEmail(data.email) })
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveName() {
    if (!nameInput.trim()) return
    setSaving(true)
    try {
      await updateMe(token!, nameInput.trim())
      storeSetNombre(nameInput.trim())
      setNombre(nameInput.trim())
      setEditingName(false)
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    logout()
    router.replace('/(auth)/login')
  }

  function initials(name: string) {
    return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Profile header */}
        <View style={styles.profileWrap}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarText}>{initials(nombre)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Pressable
              style={styles.nameRow}
              onPress={() => { setNameInput(nombre); setEditingName(true) }}
            >
              <Text style={styles.profileName}>{nombre}</Text>
              <Ionicons name="pencil-outline" size={15} color="#9ca3af" />
            </Pressable>
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.sectionBox}>
          <Row icon="mail-outline" label="Email" value={email} />
          <Sep />
          <Row icon="star-outline" label="Subscription" value="FREE" />
          <Sep />
          <Row icon="refresh-outline" label="Restore Purchases" />
          <Sep />
          <Pressable style={[styles.row, styles.rowLast]}>
            <Ionicons name="arrow-up-circle-outline" size={20} color={accentColor} />
            <Text style={[styles.rowLabel, { color: accentColor, fontWeight: '600' }]}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </Pressable>
        </View>

        {/* Theme */}
        <Text style={styles.sectionLabel}>THEME</Text>
        <View style={styles.sectionBox}>
          <Row icon="moon-outline" label="Appearance" value="System" />
          <Sep />
          <View style={styles.colorRow}>
            <Ionicons name="color-palette-outline" size={20} color="#6b7280" />
            <Text style={styles.colorLabel}>Accent Color</Text>
            <View style={styles.colorDots}>
              {ACCENT_COLORS.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setAccentColor(c.value as AccentColor)}
                  style={[styles.colorDot, { backgroundColor: c.value }, accentColor === c.value && styles.colorDotSelected]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* App Settings */}
        <Text style={styles.sectionLabel}>APP SETTINGS</Text>
        <View style={styles.sectionBox}>
          <Row icon="settings-outline" label="General" />
          <Sep />
          <Row icon="notifications-outline" label="Notifications" last />
        </View>

        {/* Get Help */}
        <Text style={styles.sectionLabel}>GET HELP</Text>
        <View style={styles.sectionBox}>
          <Row icon="bug-outline" label="Report App Issue" />
          <Sep />
          <Row icon="help-circle-outline" label="Help Center" last />
        </View>

        {/* Log Out */}
        <View style={[styles.sectionBox, { marginBottom: 40 }]}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={[styles.rowLabel, styles.rowRed]}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </Pressable>
        </View>

      </ScrollView>

      {/* Modal editar nombre */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingName(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit Name</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              autoFocus
              editable={!saving}
            />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: accentColor }, (!nameInput.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSaveName}
              disabled={!nameInput.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setEditingName(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { paddingTop: 24, paddingHorizontal: 16 },

  profileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#9ca3af' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: '#f9fafb' },
  rowLabel: { flex: 1, fontSize: 15, color: '#111827' },
  rowRed: { color: '#dc2626' },
  rowBlue: { color: '#2563eb', fontWeight: '600' },
  rowValue: { fontSize: 14, color: '#9ca3af', marginRight: 2 },

  sep: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 48 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151' },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  colorLabel: { flex: 1, fontSize: 15, color: '#111827' },
  colorDots: { flexDirection: 'row', gap: 10 },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
})

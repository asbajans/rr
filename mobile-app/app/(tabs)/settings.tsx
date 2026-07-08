import { useAuth } from '../../src/shared/auth'
import { api } from '../../src/shared/api-client'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput } from 'react-native'
import type { Store } from '../../src/shared/types'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState<Store | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      const s = await api.getSettings()
      setSettings(s)
      setName(s.name)
    } catch {}
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const updated = await api.updateSettings({ name: name.trim() })
      setSettings(updated)
      Alert.alert('Success', 'Settings updated')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Settings</Text>
        <Text style={styles.label}>Store Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Store name"
        />
        {settings?.site_code && (
          <Text style={styles.meta}>Site Code: {settings.site_code}</Text>
        )}
        {settings?.domain && (
          <Text style={styles.meta}>Domain: {settings.domain}</Text>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.meta}>Email: {user?.email}</Text>
        <Text style={styles.meta}>AI Credits: {user?.ai_credits}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
    marginBottom: 16, backgroundColor: '#f9f9f9',
  },
  meta: { fontSize: 14, color: '#666', marginBottom: 4 },
  saveBtn: {
    backgroundColor: '#000', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutBtn: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 16,
  },
  logoutBtnText: { color: '#666', fontSize: 15 },
})

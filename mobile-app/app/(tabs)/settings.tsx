import { useAuth } from '../../src/shared/auth'
import { api } from '../../src/shared/api-client'
import { useI18n } from '../../src/shared/i18n'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import type { Store } from '../../src/shared/types'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [settings, setSettings] = useState<Store | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  async function load() {
    try {
      const s = await api.getSettings()
      setSettings(s)
      setName(s.name)
    } catch {}
  }

  useEffect(() => { load(); loadIntegrations() }, [])

  async function loadIntegrations() {
    try {
      const list = await api.getMarketplaceIntegrations()
      setIntegrations(list.filter((i: any) => i.isActive))
    } catch { setIntegrations([]) }
  }

  async function syncAllProducts() {
    if (integrations.length === 0) {
      Alert.alert(t('error'), 'Aktif pazaryeri entegrasyonu yok')
      return
    }
    setSyncing(true)
    try {
      let total = 0
      for (const ig of integrations) {
        const mp = ig.marketplace
        try {
          const res = await api.syncAllToMarketplace(mp)
          total += res.enqueued || 0
        } catch (e: any) {
          // continue with others
        }
      }
      Alert.alert(t('success'), total > 0 ? `${total} ürün senkronizasyon kuyruğuna eklendi` : 'Senkronize edilecek ürün yok')
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setSyncing(false)
    }
  }

  async function save() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const updated = await api.updateSettings({ name: name.trim() })
      setSettings(updated)
      Alert.alert(t('success'), t('settingsUpdated'))
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert(t('error'), 'Yeni şifre en az 8 karakter olmalı')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), 'Yeni şifre ve tekrarı uyuşmuyor')
      return
    }
    setPwLoading(true)
    try {
      await api.changePassword(currentPassword || undefined, newPassword)
      Alert.alert(t('success'), 'Şifre güncellendi')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Şifre değiştirilemedi')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('storeSettings')}</Text>
        <Text style={styles.label}>{t('storeName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('storeName')}
        />
        {settings?.site_code && (
          <Text style={styles.meta}>{t('siteCode')}: {settings.site_code}</Text>
        )}
        {settings?.domain && (
          <Text style={styles.meta}>{t('domain')}: {settings.domain}</Text>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? t('saving') : t('saveChanges')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ürün Senkronizasyonu</Text>
        <Text style={styles.meta}>Aktif pazaryerleri: {integrations.length > 0 ? integrations.map((i: any) => i.marketplace).join(', ') : 'Yok'}</Text>
        <TouchableOpacity style={[styles.saveBtn, syncing && styles.disabled]} onPress={syncAllProducts} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Ürünleri Senkronize Et</Text>}
        </TouchableOpacity>
        <Text style={[styles.meta, { marginTop: 8, fontSize: 12 }]}>Tüm aktif pazaryerlerine atanmış ürünler kuyruğa eklenir.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Şifre Değiştir</Text>
        <Text style={styles.meta}>Google ile giriş yaptıysanız mevcut şifreyi boş bırakın.</Text>
        <Text style={styles.label}>Mevcut Şifre</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Mevcut şifre" secureTextEntry placeholderTextColor="#999" />
        <Text style={styles.label}>Yeni Şifre</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="En az 8 karakter" secureTextEntry placeholderTextColor="#999" />
        <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Yeni şifre tekrar" secureTextEntry placeholderTextColor="#999" />
        <TouchableOpacity style={styles.saveBtn} onPress={changePassword} disabled={pwLoading}>
          {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Şifreyi Güncelle</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accountSection')}</Text>
        <Text style={styles.meta}>{t('email')}: {user?.email}</Text>
        <Text style={styles.meta}>{t('aiCredits')}: {user?.ai_credits}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>{t('signOut')}</Text>
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
  disabled: { opacity: 0.5 },
})

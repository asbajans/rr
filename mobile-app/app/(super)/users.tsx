import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import type { User } from '../../src/shared/types'

export default function SuperUsersScreen() {
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [pwUser, setPwUser] = useState<User | null>(null)
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminUsers()
      setUsers(res.data)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function resetPassword() {
    if (!pwUser) return
    if (!newPw || newPw.length < 8) {
      Alert.alert(t('error'), 'Yeni şifre en az 8 karakter olmalı')
      return
    }
    setPwSaving(true)
    try {
      await api.resetUserPassword(pwUser.id, newPw)
      Alert.alert(t('success'), `${pwUser.name} şifresi güncellendi`)
      setPwUser(null); setNewPw('')
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Şifre güncellenemedi')
    } finally { setPwSaving(false) }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.badge}>{item.is_admin ? t('admin') : t('user')}</Text>
            <TouchableOpacity style={styles.pwBtn} onPress={() => { setPwUser(item); setNewPw('') }}>
              <Text style={styles.pwBtnText}>Şifreyi Sıfırla</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
      <Modal visible={!!pwUser} transparent animationType="fade" onRequestClose={() => setPwUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{pwUser ? `${pwUser.name} için yeni şifre` : ''}</Text>
            <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} placeholder="Yeni şifre (min 8)" secureTextEntry placeholderTextColor="#999" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setPwUser(null)} disabled={pwSaving}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={resetPassword} disabled={pwSaving || newPw.length < 8}>
                {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: {
    fontSize: 12, color: '#fff', backgroundColor: '#000',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    alignSelf: 'flex-start', marginTop: 8, overflow: 'hidden',
  },
  pwBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#6d28d9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  pwBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  modalCancel: { backgroundColor: '#f0f0f0' },
  modalCancelText: { color: '#666', fontWeight: '600' },
  modalSave: { backgroundColor: '#6d28d9' },
  modalSaveText: { color: '#fff', fontWeight: '600' },
})

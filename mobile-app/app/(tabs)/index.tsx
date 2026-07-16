import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Pressable } from 'react-native'
import { useAuth } from '../../src/shared/auth'
import { useI18n, LOCALES } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import type { DashboardData } from '../../src/shared/types'
import { Ionicons } from '@expo/vector-icons'

type StatCard = {
  label: string
  value: string | number
  icon: keyof typeof Ionicons.glyphMap
}

export default function DashboardScreen() {
  const { user } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  async function load() {
    try {
      const d = await api.getDashboard()
      setData(d)
    } catch {}
  }

  useEffect(() => { load() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const stats: StatCard[] = [
    { label: t('products'), value: data?.stats.total_products ?? 0, icon: 'cube-outline' },
    { label: t('orders'), value: data?.stats.total_orders ?? 0, icon: 'receipt-outline' },
    { label: t('aiCredits'), value: data?.stats.ai_credits ?? 0, icon: 'sparkles-outline' },
  ]

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('welcome')}</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setLangOpen(true)} style={styles.langBtn}>
            <Ionicons name="language-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.storeCard} onPress={() => setLangOpen(true)}>
        <Text style={styles.storeLabel}>{t('store')}</Text>
        <Text style={styles.storeName}>{data?.store?.name || t('noStore')}</Text>
        {data?.store?.site_code && (
          <Text style={styles.storeCode}>{data.store.site_code}</Text>
        )}
        <Text style={styles.langHint}>{t('selectLanguage')}: {LOCALES.find((l) => l.code === locale)?.label}</Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon} size={24} color="#000" />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('selectLanguage')}</Text>
            {LOCALES.map((l) => (
              <Pressable
                key={l.code}
                style={[styles.langItem, l.code === locale && styles.langItemActive]}
                onPress={() => { setLocale(l.code); setLangOpen(false) }}
              >
                <Text style={[styles.langItemText, l.code === locale && styles.langItemTextActive]}>{l.label}</Text>
              </Pressable>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setLangOpen(false)}>
              <Text style={styles.modalCloseText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  langBtn: { padding: 8, marginRight: 4 },
  logoutBtn: { padding: 8 },
  greeting: { fontSize: 14, color: '#666' },
  name: { fontSize: 22, fontWeight: '700' },
  storeCard: {
    backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  storeLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  storeName: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  storeCode: { fontSize: 14, color: '#666', marginTop: 2 },
  langHint: { fontSize: 13, color: '#059669', marginTop: 8, fontWeight: '600' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  langItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  langItemActive: { backgroundColor: '#e8f5e9' },
  langItemText: { fontSize: 16, fontWeight: '600' },
  langItemTextActive: { color: '#059669' },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  modalCloseText: { fontSize: 16, color: '#666', fontWeight: '600' },
})

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useAuth } from '../../src/shared/auth'
import { api } from '../../src/shared/api-client'
import type { DashboardData } from '../../src/shared/types'
import { Ionicons } from '@expo/vector-icons'

type StatCard = {
  label: string
  value: string | number
  icon: keyof typeof Ionicons.glyphMap
}

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
    { label: 'Products', value: data?.stats.total_products ?? 0, icon: 'cube-outline' },
    { label: 'Orders', value: data?.stats.total_orders ?? 0, icon: 'receipt-outline' },
    { label: 'AI Credits', value: data?.stats.ai_credits ?? 0, icon: 'sparkles-outline' },
  ]

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.storeCard}>
        <Text style={styles.storeLabel}>Store</Text>
        <Text style={styles.storeName}>{data?.store?.name || 'No store assigned'}</Text>
        {data?.store?.site_code && (
          <Text style={styles.storeCode}>{data.store.site_code}</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon} size={24} color="#000" />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  greeting: { fontSize: 14, color: '#666' },
  name: { fontSize: 22, fontWeight: '700' },
  logoutBtn: { padding: 8 },
  storeCard: {
    backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  storeLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  storeName: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  storeCode: { fontSize: 14, color: '#666', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
})

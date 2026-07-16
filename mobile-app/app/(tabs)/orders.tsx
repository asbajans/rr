import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import { Logo } from '../../src/shared/components/Logo'
import { formatPrice } from '../../src/shared/utils'
import type { DropshippingOrder } from '../../src/shared/types'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fff3e0', color: '#e65100' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped: { bg: '#ede7f6', color: '#4527a0' },
  delivered: { bg: '#e8f5e9', color: '#2e7d32' },
  cancelled: { bg: '#fce4ec', color: '#c62828' },
  returned: { bg: '#f3e5f5', color: '#6a1b9a' },
}

export default function OrdersScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [orders, setOrders] = useState<DropshippingOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminDropshippingOrders()
      setOrders(res.data)
      setTotal(res.total)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.count}>{total} {t('marketplaceOrders')}</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Logo width={100} height={26} />
            <Text style={styles.title}>{t('orders')}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('noOrders')}</Text>}
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status ?? ''] ?? { bg: '#eee', color: '#333' }
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/orders/${item.id}`)}>
              <View style={styles.cardLeft}>
                <Text style={styles.orderId}>#{item.external_id ?? item.id}</Text>
                <Text style={styles.marketplace}>{item.marketplace}</Text>
                <Text style={styles.customer}>{item.customer_name ?? '—'}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.price}>{formatPrice(item.grand_total ?? 0, item.currency)}</Text>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  count: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  orderId: { fontSize: 16, fontWeight: '700' },
  marketplace: { fontSize: 13, color: '#999', marginTop: 2, textTransform: 'capitalize' },
  customer: { fontSize: 13, color: '#666', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  price: { fontSize: 15, fontWeight: '600' },
  badge: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
})

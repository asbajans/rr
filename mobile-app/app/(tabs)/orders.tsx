import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import { formatPrice } from '../../src/shared/utils'
import type { DropshippingOrder } from '../../src/shared/types'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fff3e0', color: '#e65100' },
  confirmed: { bg: '#e0f2fe', color: '#0369a1' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped: { bg: '#ede7f6', color: '#4527a0' },
  delivered: { bg: '#e8f5e9', color: '#2e7d32' },
  cancelled: { bg: '#fce4ec', color: '#c62828' },
  returned: { bg: '#f3e5f5', color: '#6a1b9a' },
}

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
const PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function OrdersScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()
  const { t } = useI18n()
  const [orders, setOrders] = useState<DropshippingOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(typeof params.status === 'string' ? params.status : '')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  useEffect(() => {
    const s = typeof params.status === 'string' && params.status ? params.status : ''
    setStatusFilter(s)
    setPage(1)
  }, [params.status])

  async function load() {
    try {
      const res = await api.getAdminDropshippingOrders({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: perPage,
      })
      setOrders(res.data)
      setTotal(res.total)
      setLastPage(Math.max(1, res.last_page))
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [search, statusFilter, page, perPage])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function cyclePerPage() {
    const idx = PER_PAGE_OPTIONS.indexOf(perPage)
    setPage(1)
    setPerPage(PER_PAGE_OPTIONS[(idx + 1) % PER_PAGE_OPTIONS.length])
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('orders')}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingRight: 16 }}>
              <TouchableOpacity
                style={[styles.chip, statusFilter === '' && styles.chipActive]}
                onPress={() => { setPage(1); setStatusFilter('') }}
              >
                <Text style={[styles.chipText, statusFilter === '' && styles.chipTextActive]}>{t('all')}</Text>
              </TouchableOpacity>
              {ORDER_STATUSES.map((s) => {
                const c = STATUS_COLORS[s]
                const active = statusFilter === s
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { setPage(1); setStatusFilter(active ? '' : s) }}
                  >
                    <Text style={[styles.chipText, !active && { color: c.color }, active && styles.chipTextActive]}>
                      {t('status_' + s)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <View style={styles.pagerRow}>
              <View style={styles.pagerLeft}>
                <Text style={styles.pagerLabel}>{t('perPage')}:</Text>
                <TouchableOpacity style={styles.pagerSelect} onPress={cyclePerPage}>
                  <Text style={styles.pagerSelectText}>{perPage}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pagerRight}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.disabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.pageBtnText}>{t('prev')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{t('page')} {page}/{lastPage}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= lastPage && styles.disabled]}
                  onPress={() => setPage((p) => Math.min(lastPage, p + 1))}
                >
                  <Text style={styles.pageBtnText}>{t('next')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.count}>{total} {t('marketplaceOrders')}</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('noOrders')}</Text> : null}
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
                  <Text style={[styles.badgeText, { color: sc.color }]}>{item.status ? t('status_' + item.status) : ''}</Text>
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff', marginTop: 8 },
  chipsRow: { marginTop: 10, flexGrow: 0 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, backgroundColor: '#fff', marginRight: 8, height: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#333' },
  chipTextActive: { color: '#fff' },
  pagerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pagerLeft: { flexDirection: 'row', alignItems: 'center' },
  pagerLabel: { fontSize: 13, color: '#666', marginRight: 6 },
  pagerSelect: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pagerSelectText: { fontSize: 13 },
  pagerRight: { flexDirection: 'row', alignItems: 'center' },
  pageBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pageBtnText: { fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#666', marginHorizontal: 8 },
  count: { fontSize: 14, color: '#666', marginTop: 10 },
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
  disabled: { opacity: 0.5 },
})

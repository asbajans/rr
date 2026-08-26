import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import type { B2bProductItem } from '../../../src/shared/types'

export default function B2bDiscoverScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [items, setItems] = useState<B2bProductItem[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load(targetPage = 1) {
    try {
      const res = await api.getB2bDiscover({ page: targetPage, limit: perPage, search: search || undefined })
      setItems(res.data)
      setLastPage(Math.max(1, res.last_page))
      setPage(targetPage)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load(1) }, [search, perPage])

  function cyclePerPage() {
    const opts = [10, 20, 50, 100]
    const idx = opts.indexOf(perPage)
    setPerPage(opts[(idx + 1) % opts.length])
  }

  function onRefresh() { setRefreshing(true); load(page) }

  async function sendRequest(item: B2bProductItem) {
    try {
      await api.createB2bRequest({ product_id: item.id })
      Alert.alert(t('success'), t('b2bRequestSent'))
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('b2bDiscover')}</Text>
        <Text style={styles.subtitle}>{items.length} {t('products')}</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          placeholder={t('searchPlaceholder')}
          value={search}
          onChangeText={(v) => setSearch(v)}
        />
        <View style={styles.perPageBox}>
          <Text style={styles.perPageLabel}>{t('perPage')}:</Text>
          <TouchableOpacity style={styles.pagerSelect} onPress={cyclePerPage}>
            <Text style={styles.pagerSelectText}>{perPage}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('b2bNoProducts')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.images && item.images[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.thumb} />
              ) : null}
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.label}</Text>
                <Text style={styles.code}>{item.code}{item.store_name ? ` · ${item.store_name}` : ''}</Text>
                {item.supplier && (
                  <View style={styles.supplierRow}>
                    <Text style={styles.supplierRating}>
                      {item.supplier.ratingCount && Number(item.supplier.ratingAvg) > 0
                        ? `★ ${Number(item.supplier.ratingAvg).toFixed(1)} (${item.supplier.ratingCount})`
                        : t('supplierNoRating')}
                    </Text>
                    {item.supplier.maxShipmentDays != null && (
                      <Text style={styles.supplierDays}>≤ {item.supplier.maxShipmentDays} {t('days')}</Text>
                    )}
                  </View>
                )}
                <View style={styles.meta}>
                  <Text style={styles.price}>{item.price != null ? `${item.price} ₺` : '-'}</Text>
                  <Text style={styles.stock}>{t('stock')}: {item.stock}</Text>
                </View>
                {(item.b2b_discount != null || item.b2b_price != null) && (
                  <Text style={styles.b2bInfo}>
                    {item.b2b_discount != null ? `%${item.b2b_discount} ${t('discount')}` : ''}
                    {item.b2b_discount != null && item.b2b_price != null ? ' · ' : ''}
                    {item.b2b_price != null ? `${item.b2b_price} ₺` : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.cloneBtn} onPress={() => sendRequest(item)}>
                <Text style={styles.cloneBtnText}>{t('b2bSendRequest')}</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pageBtn, page <= 1 && styles.disabled]}
          onPress={() => { if (page > 1) load(page - 1) }}
        >
          <Text style={styles.pageBtnText}>{t('prev')}</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>{t('page')} {page}/{lastPage}</Text>
        <TouchableOpacity
          style={[styles.pageBtn, page >= lastPage && styles.disabled]}
          onPress={() => { if (page < lastPage) load(page + 1) }}
        >
          <Text style={styles.pageBtnText}>{t('next')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#666' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  perPageBox: { flexDirection: 'row', alignItems: 'center' },
  perPageLabel: { fontSize: 12, color: '#666', marginRight: 4 },
  pagerSelect: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  pagerSelectText: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  code: { fontSize: 12, color: '#999', marginTop: 2 },
  supplierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  supplierRating: { fontSize: 11, color: '#b45309', fontWeight: '600' },
  supplierDays: { fontSize: 11, color: '#0369a1', fontWeight: '600' },
  meta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  price: { fontSize: 14, fontWeight: '600' },
  stock: { fontSize: 13, color: '#666' },
  b2bInfo: { fontSize: 12, color: '#e65100', marginTop: 2, fontWeight: '600' },
  cloneBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  cloneBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  pageBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  pageBtnText: { fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#666' },
  disabled: { opacity: 0.5 },
})

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import type { B2bRequest } from '../../../src/shared/types'

type Tab = 'incoming' | 'outgoing'

const STATUS_BADGE: Record<string, { bg: string; color: string; key: string }> = {
  pending: { bg: '#fff3e0', color: '#e65100', key: 'b2bStatusPending' },
  approved: { bg: '#e8f5e9', color: '#2e7d32', key: 'b2bStatusApproved' },
  rejected: { bg: '#fce4ec', color: '#c62828', key: 'b2bStatusRejected' },
}

export default function B2bRequestsScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('incoming')
  const [items, setItems] = useState<B2bRequest[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await api.getB2bRequests({ type: tab })
      setItems(res.data)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [tab])

  function onRefresh() { setRefreshing(true); load() }

  async function approve(id: string) {
    try {
      await api.updateB2bRequest(id, 'approved')
      Alert.alert(t('success'), t('b2bRequestApproved'))
      load()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function reject(id: string) {
    try {
      await api.updateB2bRequest(id, 'rejected')
      Alert.alert(t('success'), t('b2bRequestRejected'))
      load()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function clone(id: string) {
    try {
      await api.cloneB2bRequest(id)
      Alert.alert(t('success'), t('b2bCloned'))
      load()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('b2bRequests')}</Text>
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'incoming' && styles.tabActive]}
          onPress={() => setTab('incoming')}
        >
          <Text style={[styles.tabText, tab === 'incoming' && styles.tabTextActive]}>{t('b2bIncoming')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'outgoing' && styles.tabActive]}
          onPress={() => setTab('outgoing')}
        >
          <Text style={[styles.tabText, tab === 'outgoing' && styles.tabTextActive]}>{t('b2bOutgoing')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('b2bNoRequests')}</Text>}
          renderItem={({ item }) => {
            const sb = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending
            const storeName = tab === 'incoming' ? item.from_store_name : item.to_store_name
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{item.product?.label ?? item.product_id}</Text>
                  <View style={[styles.badge, { backgroundColor: sb.bg }]}>
                    <Text style={[styles.badgeText, { color: sb.color }]}>{t(sb.key)}</Text>
                  </View>
                </View>
                {storeName ? <Text style={styles.store}>{storeName}</Text> : null}
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                <View style={styles.actions}>
                  {tab === 'incoming' && item.status === 'pending' ? (
                    <>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)}>
                        <Text style={styles.approveText}>{t('confirm')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(item.id)}>
                        <Text style={styles.rejectText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cloneBtn} onPress={() => clone(item.id)}>
                        <Text style={styles.cloneText}>{t('b2bClone')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {tab === 'incoming' && item.status === 'approved' ? (
                    <TouchableOpacity style={styles.cloneBtn} onPress={() => clone(item.id)}>
                      <Text style={styles.cloneText}>{t('b2bClone')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )
          }}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tab: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', paddingVertical: 8 },
  tabActive: { backgroundColor: '#000', borderColor: '#000' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#333' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  store: { fontSize: 13, color: '#666', marginTop: 4 },
  note: { fontSize: 13, color: '#999', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  approveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  rejectText: { color: '#dc2626', fontSize: 13 },
  cloneBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  cloneText: { color: '#000', fontSize: 13, fontWeight: '700' },
})

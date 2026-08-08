import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity, Linking } from 'react-native'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'

const statusColor = (s?: string) => {
  switch (s) {
    case 'submitted': return '#d97706'
    case 'approved': return '#059669'
    case 'rejected': return '#dc2626'
    default: return '#6b7280'
  }
}

export default function SuperSuppliersScreen() {
  const { t } = useI18n()
  const [items, setItems] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  async function load() {
    try {
      const data = await api.getSupplierApplications()
      setItems(Array.isArray(data) ? data : [])
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

  async function review(id: number, approve: boolean) {
    setBusy(id)
    try {
      if (approve) {
        await api.approveSupplierApplication(id)
      } else {
        await api.rejectSupplierApplication(id)
      }
      Alert.alert(t('success'), approve ? t('supplierApproved') : t('supplierRejected'))
      await load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setBusy(null)
    }
  }

  const docEntries = (docs: any) => [
    { label: t('supplierTaxDoc'), url: docs?.taxDocument },
    { label: t('supplierSignatureDoc'), url: docs?.signatureDocument },
    { label: t('supplierTradeRegistryDoc'), url: docs?.tradeRegistryDocument },
  ].filter((d) => d.url)

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('supplierNoApplications')}</Text>}
        renderItem={({ item }) => {
          const st = item.applicationStatus
          const store = item.store || {}
          return (
            <View style={styles.card}>
              <View style={styles.head}>
                <View style={styles.headLeft}>
                  <Text style={styles.name}>{store.name || item.name || `#${item.id}`}</Text>
                  <Text style={styles.meta}>{store.email || item.email || ''}{item.taxId ? ` · Vergi: ${item.taxId}` : ''}</Text>
                </View>
                <Text style={[styles.badge, { color: statusColor(st) }]}>{st}</Text>
              </View>
              {docEntries(item.applicationDocuments).map((d) => (
                <TouchableOpacity key={d.label} onPress={() => Linking.openURL(d.url)}>
                  <Text style={styles.docLink}>📎 {d.label}</Text>
                </TouchableOpacity>
              ))}
              {item.rejectionNote ? <Text style={styles.note}>{item.rejectionNote}</Text> : null}
              {(st === 'submitted' || st === 'rejected') && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.btn, styles.approveBtn]} disabled={busy === item.id} onPress={() => review(item.id, true)}>
                    <Text style={styles.approveText}>{t('supplierAccept')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.rejectBtn]} disabled={busy === item.id} onPress={() => review(item.id, false)}>
                    <Text style={styles.rejectText}>{t('supplierReject')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headLeft: { flex: 1, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  docLink: { fontSize: 13, color: '#4f46e5', marginTop: 8, fontWeight: '500' },
  note: { fontSize: 12, color: '#dc2626', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveBtn: { backgroundColor: '#ecfdf5' },
  approveText: { color: '#059669', fontSize: 13, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#fef2f2' },
  rejectText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#999', paddingVertical: 40 },
})

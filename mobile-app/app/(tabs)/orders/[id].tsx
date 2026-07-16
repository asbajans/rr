import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api } from '../../../src/shared/api-client'
import { formatPrice, formatDate } from '../../../src/shared/utils'
import type { DropshippingOrder, OrderStatusHistory } from '../../../src/shared/types'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fff3e0', color: '#e65100' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped: { bg: '#ede7f6', color: '#4527a0' },
  delivered: { bg: '#e8f5e9', color: '#2e7d32' },
  cancelled: { bg: '#fce4ec', color: '#c62828' },
  returned: { bg: '#f3e5f5', color: '#6a1b9a' },
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<DropshippingOrder | null>(null)

  async function load() {
    try {
      const res = await api.getAdminDropshippingOrder(parseInt(id, 10))
      setOrder(res)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Order not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const sc = STATUS_COLORS[order.status ?? ''] ?? { bg: '#eee', color: '#333' }
  const items = order.items ?? []

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.code}>#{order.external_id ?? order.id}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.marketplace}>{order.marketplace}</Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.color }]}>{order.status}</Text>
          </View>
        </View>
        <Text style={styles.total}>{formatPrice(order.grand_total ?? 0, order.currency)}</Text>
        {order.ordered_at ? <Text style={styles.meta}>Ordered: {formatDate(order.ordered_at)}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.line}>{order.customer_name ?? '—'}</Text>
        {order.customer_email ? <Text style={styles.meta}>{order.customer_email}</Text> : null}
        {order.customer_phone ? <Text style={styles.meta}>{order.customer_phone}</Text> : null}
        {order.shipping_address ? (
          <Text style={styles.meta}>
            {order.shipping_address}
            {order.shipping_district ? `, ${order.shipping_district}` : ''}
            {order.shipping_city ? `, ${order.shipping_city}` : ''}
            {order.zip_code ? ` ${order.zip_code}` : ''}
          </Text>
        ) : null}
      </View>

      {items.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((it: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{it.name ?? it.title ?? `#${i + 1}`}</Text>
                {it.sku || it.barcode ? <Text style={styles.meta}>{it.sku ?? it.barcode}</Text> : null}
                {it.quantity ? <Text style={styles.meta}>Qty: {it.quantity}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatPrice(it.unit_price ?? it.price ?? it.line_total ?? 0, order.currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Totals</Text>
        <View style={styles.totalRow}><Text style={styles.meta}>Subtotal</Text><Text style={styles.meta}>{formatPrice(order.subtotal ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>Shipping</Text><Text style={styles.meta}>{formatPrice(order.shipping_cost ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>Discount</Text><Text style={styles.meta}>{formatPrice(order.discount ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>Tax</Text><Text style={styles.meta}>{formatPrice(order.tax ?? 0, order.currency)}</Text></View>
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Grand Total</Text>
          <Text style={styles.grandValue}>{formatPrice(order.grand_total ?? 0, order.currency)}</Text>
        </View>
      </View>

      {(order.tracking_number || order.tracking_company) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tracking</Text>
          {order.tracking_company ? <Text style={styles.line}>{order.tracking_company}</Text> : null}
          {order.tracking_number ? <Text style={styles.tracking}>{order.tracking_number}</Text> : null}
        </View>
      )}

      {order.status_history && order.status_history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status History</Text>
          {order.status_history.map((h: OrderStatusHistory) => (
            <View key={h.id} style={styles.historyRow}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLORS[h.to_status ?? '']?.color ?? '#999' }]} />
              <View style={styles.historyBody}>
                <Text style={styles.historyStatus}>{h.to_status}</Text>
                {h.note ? <Text style={styles.meta}>{h.note}</Text> : null}
                {h.created_at ? <Text style={styles.meta}>{formatDate(h.created_at)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 16, color: '#000', fontWeight: '600' },
  backBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#000', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  code: { fontSize: 13, color: '#999' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marketplace: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  total: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  line: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '600', marginLeft: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandRow: { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 6, paddingTop: 8 },
  grandLabel: { fontSize: 15, fontWeight: '700' },
  grandValue: { fontSize: 15, fontWeight: '800' },
  tracking: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 10 },
  historyBody: { flex: 1 },
  historyStatus: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
})

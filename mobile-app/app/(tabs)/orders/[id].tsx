import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Pressable,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import { formatPrice, formatDate } from '../../../src/shared/utils'
import type { DropshippingOrder, OrderStatusHistory } from '../../../src/shared/types'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fff3e0', color: '#e65100' },
  confirmed: { bg: '#e3f2fd', color: '#0d47a1' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped: { bg: '#ede7f6', color: '#4527a0' },
  delivered: { bg: '#e8f5e9', color: '#2e7d32' },
  cancelled: { bg: '#fce4ec', color: '#c62828' },
  returned: { bg: '#f3e5f5', color: '#6a1b9a' },
}

const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'pending', labelKey: 'status_pending' },
  { value: 'confirmed', labelKey: 'status_confirmed' },
  { value: 'processing', labelKey: 'status_processing' },
  { value: 'shipped', labelKey: 'status_shipped' },
  { value: 'delivered', labelKey: 'status_delivered' },
  { value: 'cancelled', labelKey: 'status_cancelled' },
  { value: 'returned', labelKey: 'status_returned' },
]

export default function OrderDetailScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<DropshippingOrder | null>(null)
  const [capabilities, setCapabilities] = useState<{ integrationConnected: boolean; unsupported: string[] } | null>(null)
  const [invoiceLink, setInvoiceLink] = useState('')
  const [refundId, setRefundId] = useState('')
  const [marketplaceBusy, setMarketplaceBusy] = useState(false)
  const [ratingFor, setRatingFor] = useState<{ supplierId: number; supplierName: string } | null>(null)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingBusy, setRatingBusy] = useState(false)

  // New: status / tracking management
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [trackingBusy, setTrackingBusy] = useState(false)
  const [labelBusy, setLabelBusy] = useState(false)
  const [labelData, setLabelData] = useState<{ labelUrl: string | null; labelZpl: string | null; cargoCompany: string | null } | null>(null)
  const [newTrackingNumber, setNewTrackingNumber] = useState('')
  const [newCarrier, setNewCarrier] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminDropshippingOrder(parseInt(id, 10))
      setOrder(res)
      setNewTrackingNumber((res as any).tracking_number || (res as any).trackingNumber || '')
      setNewCarrier((res as any).carrier || (res as any).tracking_company || '')
      setLabelData({
        labelUrl: (res as any).label_url || (res as any).labelUrl || null,
        labelZpl: (res as any).label_zpl || (res as any).labelZpl || null,
        cargoCompany: (res as any).cargo_company || (res as any).cargoCompany || null,
      })
      api.getAdminOrderCapabilities(id).then(setCapabilities).catch(() => setCapabilities(null))
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function submitRating() {
    if (!ratingFor || rating < 1) return Alert.alert(t('error'), t('supplierRateHint'))
    setRatingBusy(true)
    try {
      await api.rateSupplier({ supplierId: ratingFor.supplierId, orderId: parseInt(id, 10), rating, comment: ratingComment || undefined })
      Alert.alert(t('ok'), t('supplierRated'))
      setRatingFor(null); setRating(0); setRatingComment('')
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setRatingBusy(false)
    }
  }

  async function sendInvoice() {
    if (!invoiceLink) return Alert.alert(t('error'), 'Fatura bağlantısı gerekli')
    setMarketplaceBusy(true)
    try { await api.updateMarketplaceInvoice(id, invoiceLink); Alert.alert('Başarılı', 'Fatura bağlantısı gönderildi'); setInvoiceLink('') }
    catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setMarketplaceBusy(false) }
  }

  async function updateReturn(decision: 'approve' | 'reject') {
    if (!refundId) return Alert.alert(t('error'), 'Pazarama iade ID gerekli')
    setMarketplaceBusy(true)
    try { await api.updateMarketplaceReturn(id, refundId, decision); Alert.alert('Başarılı', decision === 'approve' ? 'İade onaylandı' : 'İade reddedildi'); setRefundId('') }
    catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setMarketplaceBusy(false) }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusPickerOpen(false)
    if (!order || newStatus === order.status) return
    setStatusBusy(true)
    try {
      await api.updateOrderStatus(String(order.id), newStatus)
      Alert.alert(t('success'), `${t('status_' + newStatus)} olarak güncellendi`)
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setStatusBusy(false)
    }
  }

  async function handleTrackingSave() {
    if (!newTrackingNumber.trim() || !newCarrier.trim()) {
      Alert.alert(t('error'), 'Kargo takip no ve firma zorunludur (min 5 karakter)')
      return
    }
    setTrackingBusy(true)
    try {
      await api.updateOrderTracking(String(order!.id), newTrackingNumber.trim(), newCarrier.trim())
      Alert.alert(t('success'), 'Kargo bilgisi kaydedildi')
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setTrackingBusy(false)
    }
  }

  async function handleGetLabel() {
    setLabelBusy(true)
    try {
      const res = await api.getOrderLabel(String(order!.id))
      setLabelData(res)
      if (res.labelUrl) {
        Alert.alert(t('success'), `Etiket hazır: ${res.cargoCompany || ''}`)
      } else {
        Alert.alert(t('error'), res.reason || 'Etiket henüz hazır değil')
      }
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLabelBusy(false)
    }
  }

  async function handleRefund() {
    if (!order) return
    Alert.alert('Para İadesi', 'Bu siparişe iade yapılsın mı?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('ok'),
        style: 'destructive',
        onPress: async () => {
          setRefundBusy(true)
          try {
            await api.refundOrder(String(order.id))
            Alert.alert(t('success'), 'İade işlemi başlatıldı')
            load()
          } catch (e: any) {
            Alert.alert(t('error'), e.message)
          } finally {
            setRefundBusy(false)
          }
        },
      },
    ])
  }

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
        <Text>{t('productNotFound')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t('back')}</Text>
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
          <Text style={styles.back}>&lt; {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.code}>#{order.external_id ?? order.id}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.marketplace}>{order.marketplace}</Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.color }]}>{order.status ? t('status_' + order.status) : ''}</Text>
          </View>
        </View>
        <Text style={styles.total}>{formatPrice(order.grand_total ?? 0, order.currency)}</Text>
        {order.ordered_at ? <Text style={styles.meta}>{t('ordered')}: {formatDate(order.ordered_at)}</Text> : null}
      </View>

      {/* Order actions: status + tracking — requested feature 1 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sipariş İşlemleri</Text>
        <Text style={styles.meta}>Durum değiştir, kargo bilgisi gir, etiket/fatura oluştur</Text>

        <Text style={styles.label}>Sipariş Durumu</Text>
        <TouchableOpacity style={styles.input} onPress={() => setStatusPickerOpen(true)} disabled={statusBusy}>
          <Text style={styles.pickerValue}>{order.status ? t('status_' + order.status) : 'Seçin'}</Text>
          <Text style={styles.pickerArrow}>▾</Text>
        </TouchableOpacity>
        {statusBusy && <ActivityIndicator size="small" style={{ marginTop: 8 }} />}

        <Text style={styles.label}>Kargo Takip No</Text>
        <TextInput value={newTrackingNumber} onChangeText={setNewTrackingNumber} placeholder="örn. 1234567890" style={styles.inputText} autoCapitalize="characters" />
        <Text style={styles.label}>Kargo Firması</Text>
        <TextInput value={newCarrier} onChangeText={setNewCarrier} placeholder="örn. Aras, Yurtiçi, MNG" style={styles.inputText} />
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 10 }]} onPress={handleTrackingSave} disabled={trackingBusy}>
          {trackingBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionText}>Kargo Bilgisini Kaydet</Text>}
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.approveBtn} onPress={handleGetLabel} disabled={labelBusy}>
            {labelBusy ? <ActivityIndicator size="small" /> : <Text style={styles.actionTextAlt}>Etiket Getir</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={() => api.createOrderInvoice(String(order.id)).then(() => Alert.alert(t('success'), 'Fatura oluşturuldu')).catch((e: any) => Alert.alert(t('error'), e.message))}>
            <Text style={styles.actionTextAlt}>Fatura Oluştur</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={() => api.createShippingLabel(String(order.id)).then(() => Alert.alert(t('success'), 'Kargo etiketi oluşturuldu')).catch((e: any) => Alert.alert(t('error'), e.message))}>
            <Text style={styles.actionTextAlt}>Kargo Etiketi</Text>
          </TouchableOpacity>
        </View>
        {labelData?.labelUrl ? <Text style={styles.meta}>Etiket: {labelData.labelUrl}</Text> : null}
        {order.tracking_number || order.tracking_company ? <Text style={styles.meta}>Kayıtlı: {order.tracking_company || newCarrier} - {order.tracking_number || newTrackingNumber}</Text> : null}

        <TouchableOpacity style={[styles.rejectBtn, { marginTop: 8, backgroundColor: '#fff3e0', borderColor: '#e65100' }]} onPress={handleRefund} disabled={refundBusy}>
          <Text style={[styles.rejectText, { color: '#e65100' }]}>Para İadesi Yap</Text>
        </TouchableOpacity>
      </View>

      {capabilities && (capabilities.unsupported.length > 0 || !capabilities.integrationConnected) ? (
        <View style={[styles.card, { backgroundColor: '#fff8e1' }]}>
          <Text style={styles.sectionTitle}>Pazaryeri işlemleri</Text>
          <Text style={styles.meta}>
            {!capabilities.integrationConnected
              ? 'Pazaryeri entegrasyonu bağlı değil.'
              : `Desteklenmeyen işlemler: ${capabilities.unsupported.join(', ')}`}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('customerSection')}</Text>
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
          <Text style={styles.sectionTitle}>{t('items')}</Text>
          {items.map((it: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{it.name ?? it.title ?? `#${i + 1}`}</Text>
                {it.sku || it.barcode ? <Text style={styles.meta}>{it.sku ?? it.barcode}</Text> : null}
                {it.quantity ? <Text style={styles.meta}>{t('qty')}: {it.quantity}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatPrice(it.unit_price ?? it.price ?? it.line_total ?? 0, order.currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {(order as any).subOrders && (order as any).subOrders.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tedarikçi Siparişleri</Text>
          {(order as any).subOrders.map((sub: any) => (
            <View key={sub.id} style={styles.subRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>
                  {sub.supplier?.name || sub.supplierName || `#${sub.id}`}
                </Text>
                {sub.supplier ? (
                  <Text style={styles.meta}>
                    {sub.supplier.ratingCount && Number(sub.supplier.ratingAvg) > 0
                      ? `★ ${Number(sub.supplier.ratingAvg).toFixed(1)} (${sub.supplier.ratingCount})`
                      : t('supplierNoRating')}
                    {sub.supplier.maxShipmentDays != null ? ` · ≤ ${sub.supplier.maxShipmentDays} ${t('days')}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.meta}>{sub.status ? t('status_' + sub.status) : ''}</Text>
              </View>
              <View style={styles.subRight}>
                <Text style={styles.itemPrice}>{formatPrice(sub.totalAmount ?? 0, sub.currency || order.currency)}</Text>
                {order.status === 'delivered' && sub.supplier && sub.supplier.ratingEnabled !== false ? (
                  <TouchableOpacity
                    style={styles.rateBtn}
                    onPress={() => setRatingFor({ supplierId: Number(sub.supplier.id ?? sub.supplier.storeId), supplierName: sub.supplier.name || 'Tedarikçi' })}
                  >
                    <Text style={styles.rateBtnText}>{t('supplierRate')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('totals')}</Text>
        <View style={styles.totalRow}><Text style={styles.meta}>{t('subtotal')}</Text><Text style={styles.meta}>{formatPrice(order.subtotal ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>{t('shipping')}</Text><Text style={styles.meta}>{formatPrice(order.shipping_cost ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>{t('discount')}</Text><Text style={styles.meta}>{formatPrice(order.discount ?? 0, order.currency)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.meta}>{t('tax')}</Text><Text style={styles.meta}>{formatPrice(order.tax ?? 0, order.currency)}</Text></View>
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>{t('grandTotal')}</Text>
          <Text style={styles.grandValue}>{formatPrice(order.grand_total ?? 0, order.currency)}</Text>
        </View>
      </View>

      {(order.tracking_number || order.tracking_company) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('tracking')}</Text>
          {order.tracking_company ? <Text style={styles.line}>{order.tracking_company}</Text> : null}
          {order.tracking_number ? <Text style={styles.tracking}>{order.tracking_number}</Text> : null}
        </View>
      )}

      {order.marketplace === 'pazarama' && !(order as any).parent_order_id ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pazarama işlemleri</Text>
          <TextInput value={invoiceLink} onChangeText={setInvoiceLink} placeholder="Fatura PDF bağlantısı" style={styles.inputText} autoCapitalize="none" />
          <TouchableOpacity style={styles.actionBtn} onPress={sendInvoice} disabled={marketplaceBusy || !invoiceLink}><Text style={styles.actionText}>Fatura bağlantısını gönder</Text></TouchableOpacity>
          <TextInput value={refundId} onChangeText={setRefundId} placeholder="Pazarama iade ID" style={styles.inputText} autoCapitalize="none" />
          <View style={styles.actionRow}><TouchableOpacity style={styles.approveBtn} onPress={() => updateReturn('approve')} disabled={marketplaceBusy || !refundId}><Text style={styles.actionText}>İadeyi onayla</Text></TouchableOpacity><TouchableOpacity style={styles.rejectBtn} onPress={() => updateReturn('reject')} disabled={marketplaceBusy || !refundId}><Text style={styles.rejectText}>İadeyi reddet</Text></TouchableOpacity></View>
        </View>
      ) : null}

      {order.status_history && order.status_history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('statusHistory')}</Text>
          {order.status_history.map((h: OrderStatusHistory) => (
            <View key={h.id} style={styles.historyRow}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLORS[h.to_status ?? '']?.color ?? '#999' }]} />
              <View style={styles.historyBody}>
                <Text style={styles.historyStatus}>{h.to_status ? t('status_' + h.to_status) : ''}</Text>
                {h.note ? <Text style={styles.meta}>{h.note}</Text> : null}
                {h.created_at ? <Text style={styles.meta}>{formatDate(h.created_at)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {ratingFor && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('supplierRate')} — {ratingFor.supplierName}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={[styles.star, rating >= s ? styles.starActive : null]}>{'★'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={ratingComment}
            onChangeText={setRatingComment}
            placeholder={t('supplierRateComment')}
            style={styles.inputText}
            multiline
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => { setRatingFor(null); setRating(0); setRatingComment('') }}>
              <Text style={styles.rejectText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={submitRating} disabled={ratingBusy || rating < 1}>
              <Text style={styles.actionText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={statusPickerOpen} transparent animationType="fade" onRequestClose={() => setStatusPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStatusPickerOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sipariş Durumu Seç</Text>
            {STATUS_OPTIONS.map((o) => (
              <TouchableOpacity key={o.value} style={styles.modalOption} onPress={() => handleStatusChange(o.value)}>
                <Text style={styles.modalOptionText}>{t(o.labelKey)}</Text>
                {order.status === o.value ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setStatusPickerOpen(false)}>
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 10, marginBottom: 4 },
  input: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  inputText: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14, marginBottom: 4 },
  pickerValue: { fontSize: 14, color: '#000' },
  pickerArrow: { fontSize: 14, color: '#999' },
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
  actionBtn: { backgroundColor: '#000', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 6 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionTextAlt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  approveBtn: { flex: 1, backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7' },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: '#e57373', borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  rejectText: { color: '#c62828', fontWeight: '700', fontSize: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 10 },
  historyBody: { flex: 1 },
  historyStatus: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  subRight: { alignItems: 'flex-end', marginLeft: 12 },
  rateBtn: { backgroundColor: '#3949ab', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  rateBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 28, color: '#ccc' },
  starActive: { color: '#f59e0b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 24 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalOptionText: { fontSize: 15 },
  modalCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 12, backgroundColor: '#f5f5f5', borderRadius: 10 },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  check: { color: '#059669', fontWeight: '700' },
})

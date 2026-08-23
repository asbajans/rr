import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'

type Tab = 'profile' | 'orders' | 'settlements' | 'requests'

const fmt = (n: number | string | null | undefined) => {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const statusColor = (s?: string) => {
  switch (s) {
    case 'rejected': return '#dc2626'
    case 'fulfilled': return '#059669'
    case 'shipped': return '#4f46e5'
    case 'requested': return '#d97706'
    case 'paid': return '#059669'
    case 'approved': return '#059669'
    case 'pending': return '#d97706'
    default: return '#6b7280'
  }
}

const docFields = [
  { key: 'taxDocument', labelKey: 'supplierTaxDoc', required: true },
  { key: 'signatureDocument', labelKey: 'supplierSignatureDoc', required: true },
  { key: 'tradeRegistryDocument', labelKey: 'supplierTradeRegistryDoc', required: false },
] as const

type DocKey = typeof docFields[number]['key']

export default function SupplierScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)

  // Profile
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)

  // Application (başvuru) documents
  const [applicationForm, setApplicationForm] = useState<Record<DocKey, { name: string; url: string } | null>>({
    taxDocument: null,
    signatureDocument: null,
    tradeRegistryDocument: null,
  })
  const [uploadingDoc, setUploadingDoc] = useState<DocKey | null>(null)
  const [applying, setApplying] = useState(false)

  // Orders
  const [orders, setOrders] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Settlements
  const [settlements, setSettlements] = useState<any[]>([])
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [periodData, setPeriodData] = useState<any>(null)

  // Ship modal
  const [shipOrderId, setShipOrderId] = useState<number | null>(null)
  const [tracking, setTracking] = useState('')
  const [shipping, setShipping] = useState(false)

  // B2B Requests (moved inside supplier)
  const [b2bRequests, setB2bRequests] = useState<any[]>([])
  const [b2bTab, setB2bTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [b2bLoading, setB2bLoading] = useState(false)

  async function loadProfile() {
    try {
      const p = await api.getSupplierProfile()
      setProfile(p)
      setForm({
        name: p.name || '', email: p.email || '', phone: p.phone || '', taxId: p.taxId || '',
        bankName: p.bankName || '', iban: p.iban || '', bankOwner: p.bankOwner || '',
        commissionRate: Number(p.commissionRate || 0), payoutMethod: p.payoutMethod || 'bank',
      })
      const docs = p.applicationDocuments || {}
      const docUrl = (url?: string) => url ? { name: url.split('/').pop() || t('supplierChooseFile'), url } : null
      setApplicationForm({
        taxDocument: docUrl(docs.taxDocument),
        signatureDocument: docUrl(docs.signatureDocument),
        tradeRegistryDocument: docUrl(docs.tradeRegistryDocument),
      })
    } catch { /* ignore */ }
  }

  async function loadOrders() {
    try {
      const r = await api.getSupplierOrders({ page: 1 })
      setOrders(r.orders || r.data || [])
    } catch { /* ignore */ }
  }

  async function loadSettlements() {
    try {
      const r = await api.getSupplierSettlements({ page: 1 })
      setSettlements(r.settlements || r.data || [])
    } catch { /* ignore */ }
  }

  async function loadPeriod() {
    try {
      setPeriodData(await api.getSupplierSettlementPeriod(period))
    } catch { setPeriodData(null) }
  }

  async function loadB2bRequests() {
    setB2bLoading(true)
    try {
      const res = await api.getB2bRequests({ type: b2bTab })
      setB2bRequests(res.data || [])
    } catch {
      setB2bRequests([])
    } finally {
      setB2bLoading(false)
    }
  }

  useEffect(() => {
    loadProfile().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'orders') loadOrders()
    if (tab === 'settlements') { loadSettlements(); loadPeriod() }
    if (tab === 'requests') loadB2bRequests()
  }, [tab])

  useEffect(() => {
    if (tab === 'requests') loadB2bRequests()
  }, [b2bTab])

  function onRefresh() {
    setRefreshing(true)
    const p = tab === 'orders' ? loadOrders() : tab === 'requests' ? loadB2bRequests() : tab === 'settlements' ? loadSettlements() : loadProfile()
    Promise.resolve(p).finally(() => setRefreshing(false))
  }

  async function saveProfile() {
    try {
      const r: any = await api.updateSupplierProfile(form)
      setProfile(r.supplier || r.data || r)
      Alert.alert(t('success'), t('saved'))
      setEditing(false)
      loadProfile()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
  }

  async function runAction(fn: () => Promise<any>, okMsg: string) {
    try {
      await fn()
      Alert.alert(t('success'), okMsg)
      loadOrders()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
  }

  async function submitShip() {
    if (!shipOrderId || !tracking.trim()) {
      Alert.alert(t('error'), t('supplierTrackingPlaceholder'))
      return
    }
    setShipping(true)
    try {
      await api.supplierShipOrder(shipOrderId, tracking.trim())
      Alert.alert(t('success'), t('supplierShip'))
      setShipOrderId(null)
      setTracking('')
      loadOrders()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setShipping(false)
    }
  }

  async function requestSettlement() {
    try {
      await api.requestSupplierSettlement(period)
      Alert.alert(t('success'), t('supplierRequestSettlement'))
      loadSettlements(); loadPeriod()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    }
  }

  // B2B request actions
  async function approveB2b(id: string) {
    try {
      await api.updateB2bRequest(id, 'approved')
      Alert.alert(t('success'), t('b2bRequestApproved'))
      loadB2bRequests()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function rejectB2b(id: string) {
    try {
      await api.updateB2bRequest(id, 'rejected')
      Alert.alert(t('success'), t('b2bRequestRejected'))
      loadB2bRequests()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function cloneB2b(id: string) {
    try {
      await api.cloneB2bRequest(id)
      Alert.alert(t('success'), t('b2bCloned'))
      loadB2bRequests()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  function pickDocSource(key: DocKey, source: 'camera' | 'gallery') {
    const run = async () => {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t('error'), source === 'camera' ? t('cameraPermission') : t('galleryPermission'))
        return
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      const ext = asset.fileName?.split('.').pop()?.toLowerCase()
      const mime = asset.mimeType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')
      const name = asset.fileName || `doc-${Date.now()}.jpg`
      setUploadingDoc(key)
      try {
        const uploaded = await api.uploadImage(asset.uri, name, mime)
        setApplicationForm((prev) => ({ ...prev, [key]: { name, url: uploaded.url } }))
      } catch (e: any) {
        Alert.alert(t('error'), e.message)
      } finally {
        setUploadingDoc(null)
      }
    }
    run()
  }

  function chooseDoc(key: DocKey) {
    Alert.alert(t('supplierDocSource'), '', [
      { text: t('takePhoto'), onPress: () => pickDocSource(key, 'camera') },
      { text: t('chooseFromGallery'), onPress: () => pickDocSource(key, 'gallery') },
      { text: t('cancel'), style: 'cancel' },
    ])
  }

  async function submitApplication() {
    const missing = docFields.filter((d) => d.required && !applicationForm[d.key]?.url)
    if (missing.length > 0) {
      Alert.alert(t('error'), `${t('required')}: ${missing.map((d) => t(d.labelKey)).join(', ')}`)
      return
    }
    setApplying(true)
    try {
      await api.applySupplierApplication({
        taxDocument: applicationForm.taxDocument?.url,
        signatureDocument: applicationForm.signatureDocument?.url,
        tradeRegistryDocument: applicationForm.tradeRegistryDocument?.url,
      })
      Alert.alert(t('success'), t('supplierApplySent'))
      loadProfile()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setApplying(false)
    }
  }

  const profileFields = [
    { k: 'name', label: t('supplierCompany'), kb: 'default' as const },
    { k: 'email', label: t('email'), kb: 'email-address' as const },
    { k: 'phone', label: t('supplierPhone'), kb: 'phone-pad' as const },
    { k: 'taxId', label: t('supplierTaxId'), kb: 'default' as const },
    { k: 'bankName', label: t('supplierBank'), kb: 'default' as const },
    { k: 'iban', label: t('supplierIban'), kb: 'default' as const },
    { k: 'bankOwner', label: t('supplierIbanOwner'), kb: 'default' as const },
  ]

  const applyStatus = profile?.applicationStatus || 'draft'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('supplier')}</Text>
        <Text style={styles.subtitle}>{t('supplierOrders')}</Text>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'profile', label: t('supplierProfile') },
          { key: 'orders', label: t('supplierOrders') },
          { key: 'settlements', label: t('supplierSettlements') },
          { key: 'requests', label: t('b2bRequests') },
        ] as const).map((tItem) => (
          <TouchableOpacity key={tItem.key} style={[styles.tabBtn, tab === tItem.key && styles.tabActive]}
            onPress={() => setTab(tItem.key)}>
            <Text style={[styles.tabText, tab === tItem.key && styles.tabTextActive]}>{tItem.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={
            tab === 'orders' ? orders :
            tab === 'settlements' ? settlements :
            tab === 'requests' ? b2bRequests : []
          }
          keyExtractor={(item, i) => String((item as any).id ?? i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              {tab === 'profile' && (
                <View style={styles.profileWrap}>
                  <View style={styles.cardFlat}>
                    {applyStatus === 'approved' && (
                      <View style={[styles.statusBanner, styles.statusApproved]}>
                        <Text style={styles.statusBannerText}>{t('supplierApproved')}</Text>
                      </View>
                    )}
                    {applyStatus === 'submitted' && (
                      <View style={[styles.statusBanner, styles.statusSubmitted]}>
                        <Text style={styles.statusBannerText}>{t('supplierPending')}</Text>
                      </View>
                    )}
                    {applyStatus === 'rejected' && (
                      <View style={[styles.statusBanner, styles.statusRejected]}>
                        <Text style={styles.statusBannerText}>
                          {t('supplierRejected')}{profile?.rejectionNote ? ` · ${profile.rejectionNote}` : ''}
                        </Text>
                      </View>
                    )}

                    {!editing ? (
                      <>
                        <Text style={styles.sectionTitle}>{t('supplierProfile')}</Text>
                        {profileFields.map((f) => (
                          <View key={f.k} style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>{f.label}</Text>
                            <Text style={styles.summaryValue}>{form[f.k] || '—'}</Text>
                          </View>
                        ))}
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{t('supplierCommission')}</Text>
                          <Text style={styles.summaryValue}>%{fmt(form.commissionRate)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{t('supplierBank')}</Text>
                          <Text style={styles.summaryValue}>{form.payoutMethod === 'manual' ? t('manual') : t('bankTransfer')}</Text>
                        </View>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => setEditing(true)}>
                          <Text style={styles.primaryBtnText}>{t('editProfile')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.sectionTitle}>{t('editProfile')}</Text>
                        {profileFields.map((f) => (
                          <View key={f.k} style={styles.field}>
                            <Text style={styles.label}>{f.label}</Text>
                            <TextInput style={styles.input} value={form[f.k] || ''} keyboardType={f.kb}
                              onChangeText={(v) => setForm({ ...form, [f.k]: v })} />
                          </View>
                        ))}
                        <View style={styles.field}>
                          <Text style={styles.label}>{t('supplierCommission')}</Text>
                          <TextInput style={styles.input} keyboardType="numeric" value={String(form.commissionRate ?? 0)}
                            onChangeText={(v) => setForm({ ...form, commissionRate: Number(v) || 0 })} />
                        </View>
                        <View style={styles.rowBtns}>
                          <TouchableOpacity style={[styles.ghostBtn, styles.flex1]} onPress={() => setEditing(false)}>
                            <Text style={styles.ghostBtnText}>{t('cancel')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.primaryBtn, styles.flex1]} onPress={saveProfile}>
                            <Text style={styles.primaryBtnText}>{t('save')}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.cardFlat}>
                    <Text style={styles.sectionTitle}>{t('supplierApplyTitle')}</Text>
                    <Text style={styles.sectionDesc}>{t('supplierApplyDesc')}</Text>
                    {docFields.map((d) => {
                      const uploaded = applicationForm[d.key]
                      return (
                        <View key={d.key} style={styles.field}>
                          <Text style={styles.label}>{t(d.labelKey)}{d.required ? ` · ${t('required')}` : ''}</Text>
                          <TouchableOpacity style={styles.docBtn} onPress={() => chooseDoc(d.key)} disabled={uploadingDoc === d.key}>
                            {uploadingDoc === d.key ? (
                              <ActivityIndicator size="small" color="#18181b" />
                            ) : (
                              <Text style={[styles.docBtnText, uploaded && styles.docBtnTextDone]}>
                                {uploaded ? `✓ ${uploaded.name}` : t('supplierChooseFile')}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )
                    })}
                    <TouchableOpacity style={[styles.primaryBtn, applying && styles.disabled]} disabled={applying} onPress={submitApplication}>
                      <Text style={styles.primaryBtnText}>
                        {applying ? t('sending') : applyStatus === 'submitted' ? t('supplierUpdateApplication') : applyStatus === 'rejected' ? t('supplierReapply') : t('supplierSubmitApply')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {tab === 'settlements' && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>{t('supplierSettlements')}</Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>{t('supplierPeriod')}</Text>
                    <TextInput style={styles.input} value={period} onChangeText={setPeriod}
                      placeholder="YYYY-MM" autoCapitalize="none" />
                  </View>
                  <TouchableOpacity style={styles.ghostBtn} onPress={loadPeriod}>
                    <Text style={styles.ghostBtnText}>{t('supplierCalculate')}</Text>
                  </TouchableOpacity>
                  {periodData && (
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>{t('supplierTotal')}</Text>
                        <Text style={styles.statValue}>{fmt(periodData.computation?.totalAmount)} ₺</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>{t('supplierCommissionAmount')}</Text>
                        <Text style={styles.statValue}>{fmt(periodData.computation?.commissionAmount)} ₺</Text>
                      </View>
                      <View style={[styles.statBox, styles.statEmphasis]}>
                        <Text style={styles.statLabel}>{t('supplierNet')}</Text>
                        <Text style={styles.statValue}>{fmt(periodData.computation?.netAmount)} ₺</Text>
                      </View>
                    </View>
                  )}
                  {periodData?.settlement?.status === 'requested' ? (
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => runAction(() => api.cancelSupplierSettlement(periodData.settlement.id), t('supplierCancelRequest'))}>
                      <Text style={styles.ghostBtnText}>{t('supplierCancelRequest')}</Text>
                    </TouchableOpacity>
                  ) : periodData?.settlement?.status === 'paid' ? (
                    <Text style={styles.paidTag}>{t('supplierPaid')}</Text>
                  ) : (
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestSettlement}
                      disabled={!periodData || periodData.computation?.orderCount === 0}>
                      <Text style={styles.primaryBtnText}>{t('supplierRequestSettlement')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {tab === 'requests' && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>{t('b2bRequests')}</Text>
                  <View style={styles.b2bTabRow}>
                    <TouchableOpacity style={[styles.b2bTab, b2bTab === 'incoming' && styles.b2bTabActive]} onPress={() => setB2bTab('incoming')}>
                      <Text style={[styles.b2bTabText, b2bTab === 'incoming' && styles.b2bTabTextActive]}>{t('b2bIncoming')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.b2bTab, b2bTab === 'outgoing' && styles.b2bTabActive]} onPress={() => setB2bTab('outgoing')}>
                      <Text style={[styles.b2bTabText, b2bTab === 'outgoing' && styles.b2bTabTextActive]}>{t('b2bOutgoing')}</Text>
                    </TouchableOpacity>
                  </View>
                  {b2bLoading && <ActivityIndicator size="small" style={{ marginTop: 8 }} />}
                  {!b2bLoading && b2bRequests.length === 0 && <Text style={styles.empty}>{t('b2bNoRequests')}</Text>}
                </View>
              )}

              {tab === 'orders' && orders.length === 0 && (
                <Text style={styles.empty}>{t('supplierNoOrders')}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            if (tab === 'requests') {
              const r = item as any
              const isIncoming = b2bTab === 'incoming'
              const status = r.status
              return (
                <View style={styles.card}>
                  <View style={styles.orderRow}>
                    <View style={styles.orderLeft}>
                      <Text style={styles.orderNumber}>{r.product?.label || r.product_id}</Text>
                      <Text style={styles.orderMeta}>{isIncoming ? r.from_store_name : r.to_store_name} · {r.status}</Text>
                      {r.note ? <Text style={styles.orderMeta}>{r.note}</Text> : null}
                    </View>
                    <Text style={[styles.statusBadge, { color: statusColor(status) }]}>{status}</Text>
                  </View>
                  <View style={styles.actions}>
                    {isIncoming && status === 'pending' ? (
                      <>
                        <TouchableOpacity style={styles.actAccept} onPress={() => approveB2b(r.id)}>
                          <Text style={styles.actAcceptText}>{t('confirm')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actReject} onPress={() => rejectB2b(r.id)}>
                          <Text style={styles.actRejectText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    {!isIncoming && status === 'approved' ? (
                      <TouchableOpacity style={styles.actShip} onPress={() => cloneB2b(r.id)}>
                        <Text style={styles.actShipText}>{t('b2bClone')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )
            }
            const o = item as any
            const status = o.supplierStatus || o.status
            return (
              <View style={styles.card}>
                <View style={styles.orderRow}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderNumber}>{o.order_number || o.orderNumber}</Text>
                    <Text style={styles.orderMeta}>{o.marketplace} · {new Date(o.createdAt || o.created_at).toLocaleDateString('tr-TR')}</Text>
                    <Text style={styles.orderAmount}>{fmt(o.totalAmount)} {o.currency || 'TRY'} · {t('supplierNet')} {fmt(o.supplierEarnings ?? (Number(o.totalAmount || 0) - Number(o.commissionAmount || 0)))}</Text>
                  </View>
                  <Text style={[styles.statusBadge, { color: statusColor(status) }]}>{status}</Text>
                </View>
                {o.trackingNumber || o.tracking_number ? (
                  <Text style={styles.tracking}>{t('supplierTracking')}: {o.trackingNumber || o.tracking_number}</Text>
                ) : null}
                <View style={styles.actions}>
                  {(status === 'pending' || !status) && (
                    <>
                      <TouchableOpacity style={styles.actAccept} onPress={() => runAction(() => api.supplierAcceptOrder(o.id), t('supplierAccept'))}>
                        <Text style={styles.actAcceptText}>{t('supplierAccept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actReject} onPress={() => runAction(() => api.supplierRejectOrder(o.id), t('supplierReject'))}>
                        <Text style={styles.actRejectText}>{t('supplierReject')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {(status === 'accepted' || status === 'pending') && (
                    <TouchableOpacity style={styles.actShip} onPress={() => { setShipOrderId(o.id); setTracking('') }}>
                      <Text style={styles.actShipText}>{t('supplierShip')}</Text>
                    </TouchableOpacity>
                  )}
                  {status === 'fulfilled' && (
                    <TouchableOpacity style={styles.actReject} onPress={() => runAction(() => api.supplierReturnOrder(o.id), t('supplierReturn'))}>
                      <Text style={styles.actRejectText}>{t('supplierReturn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            tab === 'orders' || tab === 'requests' ? null : <View style={{ paddingVertical: 32 }} />
          }
        />
      )}

      <Modal visible={shipOrderId !== null} transparent animationType="fade"
        onRequestClose={() => setShipOrderId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('supplierShip')}</Text>
            <Text style={styles.label}>{t('supplierTrackingPlaceholder')}</Text>
            <TextInput style={styles.input} value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setShipOrderId(null)}>
                <Text style={styles.ghostBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.modalConfirm, shipping && styles.disabled]} disabled={shipping} onPress={submitShip}>
                <Text style={styles.primaryBtnText}>{t('ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#000' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 14, flexWrap: 'wrap' },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f4f4f5' },
  tabActive: { backgroundColor: '#000' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  profileWrap: { paddingHorizontal: 20 },
  card: { marginHorizontal: 20, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7', padding: 14 },
  cardFlat: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7', padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 8 },
  sectionDesc: { fontSize: 12, color: '#666', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#000', maxWidth: '60%' },
  statusBanner: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  statusApproved: { backgroundColor: '#ecfdf5' },
  statusSubmitted: { backgroundColor: '#fffbeb' },
  statusRejected: { backgroundColor: '#fef2f2' },
  statusBannerText: { fontSize: 12, fontWeight: '700', color: '#000' },
  field: { marginBottom: 10 },
  label: { fontSize: 11, color: '#666', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000' },
  primaryBtn: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  ghostBtn: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  ghostBtnText: { color: '#18181b', fontSize: 13, fontWeight: '600' },
  rowBtns: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  docBtn: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fafafa' },
  docBtnText: { color: '#71717a', fontSize: 13, fontWeight: '600' },
  docBtnTextDone: { color: '#059669' },
  disabled: { opacity: 0.5 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderLeft: { flex: 1 },
  orderNumber: { fontSize: 14, fontWeight: '600', color: '#000' },
  orderMeta: { fontSize: 11, color: '#999', marginTop: 2 },
  orderAmount: { fontSize: 13, color: '#18181b', marginTop: 6, fontWeight: '500' },
  statusBadge: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  tracking: { fontSize: 12, color: '#4f46e5', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actAccept: { flex: 1, backgroundColor: '#ecfdf5', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  actAcceptText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  actReject: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  actRejectText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  actShip: { flex: 1, backgroundColor: '#eef2ff', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  actShipText: { color: '#4f46e5', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#999', paddingVertical: 40 },
  b2bTabRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  b2bTab: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', paddingVertical: 8 },
  b2bTabActive: { backgroundColor: '#000', borderColor: '#000' },
  b2bTabText: { fontSize: 12, fontWeight: '600', color: '#333' },
  b2bTabTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statBox: { flex: 1, backgroundColor: '#f4f4f5', borderRadius: 10, padding: 10 },
  statEmphasis: { backgroundColor: '#ecfdf5' },
  statLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#000', marginTop: 2 },
  paidTag: { marginTop: 12, color: '#059669', fontWeight: '700', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalConfirm: { flex: 1 },
})

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, RefreshControl, Modal, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { api } from '../../src/shared/api-client'
import { useI18n } from '../../src/shared/i18n'

const CHANNELS = [
  { key: 'facebook_post', label: 'Facebook Gönderi', icon: 'share-social-outline' as const, desc: 'Sayfanda paylaşılır' },
  { key: 'facebook_story', label: 'Facebook Story', icon: 'share-social-outline' as const, desc: 'Hikaye (24s)' },
  { key: 'instagram_post', label: 'Instagram Gönderi', icon: 'camera-outline' as const, desc: 'Feed gönderisi' },
  { key: 'instagram_story', label: 'Instagram Story', icon: 'camera-outline' as const, desc: 'Hikaye + link sticker' },
]

type Section = 'publish' | 'comments' | 'messages' | 'ads' | 'insights' | 'stats'

export default function MarketingScreen() {
  const { t } = useI18n()
  const [metaStatus, setMetaStatus] = useState<any>({ connected: false, pages: [], catalogs: [], selected: null, loading: true })
  const [assets, setAssets] = useState<any>({ pages: [], catalogs: [], selected: {} })
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [selectedPage, setSelectedPage] = useState('')
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [selectedIg, setSelectedIg] = useState('')
  const [connecting, setConnecting] = useState(false)

  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [caption, setCaption] = useState('')
  const [channels, setChannels] = useState<string[]>(['facebook_post'])
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const [activeSection, setActiveSection] = useState<Section>('publish')
  const [refreshing, setRefreshing] = useState(false)

  // Comments/Messages/Ads/Insights
  const [igComments, setIgComments] = useState<any[]>([])
  const [igConversations, setIgConversations] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])
  const [pageInsights, setPageInsights] = useState<any>(null)
  const [igAccount, setIgAccount] = useState<any>(null)
  const [replyText, setReplyText] = useState('')
  const [replyTarget, setReplyTarget] = useState<string | null>(null)

  const refreshMeta = async () => {
    setMetaStatus((s: any) => ({ ...s, loading: true }))
    try {
      const a: any = await api.getMetaAssets()
      setAssets(a)
      setMetaStatus({ connected: true, pages: a.pages || [], catalogs: a.catalogs || [], selected: a.selected, loading: false })
      if (a.selected?.pageId) setSelectedPage(a.selected.pageId)
      if (a.selected?.catalogId) setSelectedCatalog(a.selected.catalogId)
      if (a.selected?.igUserId) setSelectedIg(a.selected.igUserId)
    } catch {
      setMetaStatus({ connected: false, pages: [], catalogs: [], selected: null, loading: false })
    }
  }

  const loadProducts = async (q = search) => {
    try {
      const list = await api.getProductsForMarketing(q || undefined, 24)
      setProducts(list.map((p: any) => ({ id: Number(p.id), title: p.title || p.label, sku: p.sku || p.code, images: p.images || [], priceTRY: p.priceTRY ?? p.price ?? 0 })))
    } catch {}
  }

  useEffect(() => { refreshMeta(); loadProducts('') }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await refreshMeta()
    await loadProducts(search)
    setRefreshing(false)
  }

  const handleConnect = async (mode: 'minimal' | 'full' = 'minimal') => {
    setConnecting(true); setError('')
    try {
      const { url } = await api.getMetaConnectUrl(mode)
      // Use WebBrowser for OAuth — proxy will handle redirect, we just wait for user to complete in browser
      const result = await WebBrowser.openAuthSessionAsync(url, 'rahatio://')
      // Regardless of result type, refresh status (backend will have stored token if success)
      await new Promise(r => setTimeout(r, 1500))
      await refreshMeta()
      if (result.type === 'success') setShowAssetPicker(true)
    } catch (e: any) {
      setError(e.message || 'Bağlantı başarısız')
    } finally { setConnecting(false) }
  }

  const handleSelectAssets = async () => {
    try {
      await api.selectMetaAssets({ pageId: selectedPage, catalogId: selectedCatalog, igUserId: selectedIg || null })
      await api.fbeCallback({})
      await refreshMeta()
      setShowAssetPicker(false)
      Alert.alert('Başarılı', 'Varlıklar kaydedildi')
    } catch (e: any) { setError(e.message) }
  }

  const handlePublish = async () => {
    if (selectedIds.length === 0) { setError('En az 1 ürün seçin'); return }
    if (channels.length === 0) { setError('En az 1 kanal seçin'); return }
    setPublishing(true); setError(''); setResult(null)
    try {
      const res = await api.metaPublish({ productIds: selectedIds, channels, caption: caption || undefined })
      setResult(res)
    } catch (e: any) { setError(e.message || 'Paylaşım başarısız') } finally { setPublishing(false) }
  }

  const loadComments = async () => {
    try { const r = await api.getMetaIgComments(); setIgComments(r.comments || []) } catch (e: any) { setError(e.message) }
  }
  const loadMessages = async () => {
    try { const r = await api.getMetaIgMessages(); setIgConversations(r.conversations || []) } catch (e: any) { setError(e.message) }
  }
  const loadAds = async () => {
    try { const r = await api.getMetaAds(); setAds(r.ads || []) } catch (e: any) { setError(e.message) }
  }
  const loadInsights = async () => {
    try {
      const pi = await api.getMetaPageInsights()
      setPageInsights(pi.insights)
      const acc = await api.getMetaIgAccount().catch(() => ({ account: null }))
      setIgAccount((acc as any).account)
    } catch (e: any) { setError(e.message) }
  }

  useEffect(() => {
    if (activeSection === 'comments') loadComments()
    if (activeSection === 'messages') loadMessages()
    if (activeSection === 'ads') loadAds()
    if (activeSection === 'insights' || activeSection === 'stats') loadInsights()
  }, [activeSection])

  if (metaStatus.loading) {
    return <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6366f1" /></View>
  }

  const sections: { key: Section; label: string; icon: any }[] = [
    { key: 'publish', label: 'Paylaş', icon: 'megaphone-outline' },
    { key: 'stats', label: 'Site', icon: 'globe-outline' },
    { key: 'comments', label: 'Yorum', icon: 'chatbubble-outline' },
    { key: 'messages', label: 'Mesaj', icon: 'mail-outline' },
    { key: 'ads', label: 'Reklam', icon: 'trending-up-outline' },
    { key: 'insights', label: 'Analiz', icon: 'bar-chart-outline' },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Connection Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, metaStatus.connected ? { backgroundColor: '#ecfdf5' } : { backgroundColor: '#f3f4f6' }]}>
            <Ionicons name={metaStatus.connected ? 'checkmark-circle' : 'share-social-outline'} size={20} color={metaStatus.connected ? '#10b981' : '#6b7280'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{metaStatus.connected ? 'Meta Bağlı' : 'Meta Bağlı Değil'}</Text>
            <Text style={styles.cardSub}>{metaStatus.connected ? `Sayfa: ${assets.selected?.pageId || '-'} · Katalog: ${assets.selected?.catalogId || '-'}` : 'Facebook ve Instagram’ı bağla'}</Text>
          </View>
        </View>
        {!metaStatus.connected ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleConnect('minimal')} disabled={connecting}>
              {connecting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="link-outline" size={16} color="#fff" /><Text style={styles.primaryText}>Katalog ile Bağla</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleConnect('full')} disabled={connecting}>
              <Text style={styles.secondaryText}>Tam Yetki ile Bağla</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={async () => { await api.fbeCallback({}); await refreshMeta() }}>
              <Text style={styles.primaryText}>Otomatik Kur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAssetPicker(!showAssetPicker)}>
              <Text style={styles.secondaryText}>{showAssetPicker ? 'Kapat' : 'Varlık Seç'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {showAssetPicker && metaStatus.connected && (
          <View style={styles.assetPicker}>
            <Text style={styles.label}>Facebook Sayfası</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {assets.pages.map((p: any) => (
                <TouchableOpacity key={p.id} style={[styles.chip, selectedPage === p.id && styles.chipActive]} onPress={() => setSelectedPage(p.id)}>
                  <Text style={[styles.chipText, selectedPage === p.id && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Katalog</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {assets.catalogs.map((c: any) => (
                <TouchableOpacity key={c.id} style={[styles.chip, selectedCatalog === c.id && styles.chipActive]} onPress={() => setSelectedCatalog(c.id)}>
                  <Text style={[styles.chipText, selectedCatalog === c.id && styles.chipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSelectAssets}>
              <Text style={styles.saveText}>Kaydet & Kur</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Section Tabs - horizontal scroll to prevent squishing */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
        {sections.map(s => (
          <TouchableOpacity key={s.key} onPress={() => setActiveSection(s.key)} style={[styles.tab, activeSection === s.key && styles.tabActive]}>
            <Ionicons name={s.icon} size={14} color={activeSection === s.key ? '#fff' : '#6b7280'} />
            <Text style={[styles.tabText, activeSection === s.key && styles.tabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {result && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{result.results?.filter((r: any) => r.ok).length || 0}/{result.results?.length || 0} başarılı</Text>
          {result.results?.map((r: any, i: number) => (
            <Text key={i} style={[styles.resultText, r.ok ? { color: '#059669' } : { color: '#dc2626' }]}>{r.ok ? '✓' : '✗'} {r.channel} — {r.error || r.id || ''}</Text>
          ))}
        </View>
      )}

      {/* PUBLISH SECTION */}
      {activeSection === 'publish' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ürün Seç</Text>
            <View style={styles.searchRow}>
              <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Ara (ad, SKU)" placeholderTextColor="#999" onSubmitEditing={() => loadProducts(search)} />
              <TouchableOpacity style={styles.searchBtn} onPress={() => loadProducts(search)}><Ionicons name="search" size={18} color="#fff" /></TouchableOpacity>
            </View>
            {selectedIds.length > 0 && <Text style={styles.helper}>{selectedIds.length} ürün seçildi</Text>}
            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {products.map(p => {
                const sel = selectedIds.includes(p.id)
                return (
                  <TouchableOpacity key={p.id} style={[styles.productRow, sel && styles.productRowSel]} onPress={() => setSelectedIds(prev => sel ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                    {p.images[0] ? <Image source={{ uri: p.images[0] }} style={styles.productImg} /> : <View style={[styles.productImg, { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="cube-outline" size={16} color="#999" /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.productSku}>{p.sku} · {Number(p.priceTRY).toLocaleString('tr-TR')} ₺</Text>
                    </View>
                    <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={sel ? '#6366f1' : '#d1d5db'} />
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kanallar</Text>
            {CHANNELS.map(ch => {
              const sel = channels.includes(ch.key)
              return (
                <TouchableOpacity key={ch.key} style={[styles.channelRow, sel && styles.channelRowSel]} onPress={() => setChannels(prev => sel ? prev.filter(x => x !== ch.key) : [...prev, ch.key])}>
                  <Ionicons name={ch.icon} size={18} color={sel ? '#111' : '#6b7280'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.channelLabel, sel && { color: '#111' }]}>{ch.label}</Text>
                    <Text style={styles.channelDesc}>{ch.desc}</Text>
                  </View>
                  <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={sel ? '#111' : '#d1d5db'} />
                </TouchableOpacity>
              )
            })}
            <Text style={styles.label}>Açıklama</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={caption} onChangeText={setCaption} placeholder="Boş bırakırsan başlık + link otomatik" multiline placeholderTextColor="#999" />
            <TouchableOpacity style={[styles.publishBtn, (publishing || selectedIds.length === 0) && { opacity: 0.5 }]} onPress={handlePublish} disabled={publishing || selectedIds.length === 0}>
              {publishing ? <ActivityIndicator color="#fff" /> : <><Ionicons name="megaphone-outline" size={16} color="#fff" /><Text style={styles.publishText}>Paylaş ({selectedIds.length}×{channels.length})</Text></>}
            </TouchableOpacity>
          </View>
        </>
      )}

      {activeSection === 'comments' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Instagram Yorumları</Text>
          {igComments.length === 0 ? <Text style={styles.empty}>Yorum yok — Yenile</Text> : igComments.map((c: any) => (
            <View key={c.id} style={styles.commentCard}>
              <Text style={styles.commentUser}>{c.from?.name} · {c.created_time ? new Date(c.created_time).toLocaleDateString('tr-TR') : ''}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <TouchableOpacity style={styles.smallBtn} onPress={() => { setReplyTarget(c.id); setReplyText('') }}><Text style={styles.smallBtnText}>Cevapla</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#fef2f2' }]} onPress={async () => { await api.deleteMetaIgComment(c.id); setIgComments(prev => prev.filter(x => x.id !== c.id)) }}><Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Sil</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {replyTarget && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={replyText} onChangeText={setReplyText} placeholder="Cevap yaz" />
              <TouchableOpacity style={styles.primaryBtn} onPress={async () => { await api.replyMetaIgComment(replyTarget, replyText); setReplyTarget(null); setReplyText(''); loadProducts('') }}>
                <Text style={styles.primaryText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {activeSection === 'messages' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Instagram DM</Text>
          {igConversations.length === 0 ? <Text style={styles.empty}>Sohbet yok</Text> : igConversations.map((conv: any) => (
            <View key={conv.id} style={styles.convCard}>
              <Text style={styles.convId}>Sohbet {conv.id.slice(0, 12)}…</Text>
              <TouchableOpacity onPress={async () => { const r = await api.getMetaIgConversation(conv.id); Alert.alert('Mesajlar', JSON.stringify(r.conversation?.messages?.slice(0,3) || [], null, 2).slice(0, 500)) }}>
                <Text style={{ color: '#6366f1', fontSize: 12 }}>Aç</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {activeSection === 'ads' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reklamlar</Text>
          {ads.map((ad: any) => (
            <View key={ad.id} style={styles.adCard}>
              <Text style={styles.adName}>{ad.name}</Text>
              <Text style={styles.adMeta}>{ad.objective} · {ad.status}</Text>
            </View>
          ))}
          {ads.length === 0 && <Text style={styles.empty}>Reklam yok</Text>}
        </View>
      )}

      {activeSection === 'insights' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>İstatistik</Text>
          {pageInsights ? <Text style={styles.metaText}>{JSON.stringify(pageInsights, null, 2).slice(0, 800)}</Text> : <Text style={styles.empty}>Veri yok</Text>}
          {igAccount && <Text style={[styles.metaText, { marginTop: 8 }]}>IG: @{igAccount.username} · {igAccount.followers} takipçi</Text>}
        </View>
      )}

      {activeSection === 'stats' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Site İstatistiği</Text>
          <Text style={styles.empty}>Web&apos;deki Site İstatistiği paneli yakında mobilde.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  primaryBtn: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, flex: 1 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryBtn: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', flex: 1 },
  secondaryText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  assetPicker: { marginTop: 12, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 6 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6 },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTabs: { marginBottom: 10, maxHeight: 36 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  tabActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 10, marginBottom: 8 },
  errorText: { color: '#991b1b', fontSize: 12 },
  successBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 8, padding: 10, marginBottom: 8 },
  successText: { color: '#065f46', fontWeight: '700', fontSize: 12 },
  resultText: { fontSize: 11, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  searchInput: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  searchBtn: { backgroundColor: '#111', width: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  productRowSel: { backgroundColor: '#f5f3ff' },
  productImg: { width: 36, height: 36, borderRadius: 6 },
  productTitle: { fontSize: 12, fontWeight: '600' },
  productSku: { fontSize: 11, color: '#6b7280' },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, marginBottom: 6, backgroundColor: '#fff' },
  channelRowSel: { borderColor: '#111', backgroundColor: '#f9fafb' },
  channelLabel: { fontSize: 13, fontWeight: '600' },
  channelDesc: { fontSize: 11, color: '#6b7280' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 8 },
  publishBtn: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  publishText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 12 },
  commentCard: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  commentUser: { fontSize: 11, fontWeight: '600' },
  commentText: { fontSize: 12, marginTop: 4 },
  smallBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smallBtnText: { fontSize: 11, fontWeight: '600' },
  convCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  convId: { fontSize: 12, fontWeight: '600' },
  adCard: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  adName: { fontSize: 12, fontWeight: '700' },
  adMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  metaText: { fontSize: 11, color: '#374151' },
})

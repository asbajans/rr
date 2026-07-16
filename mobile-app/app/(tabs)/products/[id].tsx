import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import { Logo } from '../../../src/shared/components/Logo'
import type { ProductDetail, MarketplaceEntry } from '../../../src/shared/types'

export default function ProductDetailScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [uploading, setUploading] = useState(false)
  const [verifyingMp, setVerifyingMp] = useState<string | null>(null)
  const [editingImg, setEditingImg] = useState<number | null>(null)
  const [imgPrompt, setImgPrompt] = useState('')

  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [status, setStatus] = useState(true)
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [marketplaces, setMarketplaces] = useState<string[]>([])
  const [marketplaceData, setMarketplaceData] = useState<Record<string, MarketplaceEntry>>({})
  const [b2bEnabled, setB2bEnabled] = useState(false)
  const [b2bDiscount, setB2bDiscount] = useState('')
  const [b2bPrice, setB2bPrice] = useState('')

  async function load() {
    try {
      const res = await api.getAdminProduct(id)
      setProduct(res)
      setLabel(res.label ?? '')
      setPrice(res.price != null ? String(res.price) : '')
      setStock(res.stock != null ? String(res.stock) : '')
      setStatus(res.status === 1)
      setDescription(res.description ?? '')
      setImages(res.images && res.images.length ? res.images : (res.image ? [res.image] : []))
      setMarketplaces(res.marketplaces ?? [])
      setMarketplaceData(res.marketplace_data ?? {})
      try {
        const b2b = await api.getProductB2b(id)
        setB2bEnabled(!!b2b?.is_b2b_enabled)
        setB2bDiscount(b2b?.b2b_discount != null ? String(b2b.b2b_discount) : '')
        setB2bPrice(b2b?.b2b_price != null ? String(b2b.b2b_price) : '')
      } catch {}
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function save() {
    setSaving(true)
    try {
      const marketplace_data: Record<string, MarketplaceEntry> = {}
      marketplaces.forEach((m) => {
        const md = marketplaceData[m] ?? {}
        marketplace_data[m] = {
          category: md.category ?? '',
          category_id: md.category_id ?? '',
          brand: md.brand ?? '',
          on_sale: m === 'Kendi Sitem' ? status : !!md.on_sale,
          status: m === 'Kendi Sitem' ? (status ? 1 : 0) : (md.on_sale ? 1 : 0),
        }
      })
      const imgs = images.map((s) => s.trim()).filter(Boolean)
      await api.updateAdminProduct(id, {
        label: label || undefined,
        price: price ? parseFloat(price) : undefined,
        stock: stock ? parseInt(stock, 10) : undefined,
        status: status ? 1 : 0,
        description: description || undefined,
        media_urls: imgs,
        marketplaces,
        marketplace_data,
      })
      Alert.alert(t('success'), t('productUpdated'))
      try {
        await api.updateProductB2b({
          product_id: id,
          is_b2b_enabled: b2bEnabled,
          b2b_discount: b2bDiscount ? parseFloat(b2bDiscount) : null,
          b2b_price: b2bPrice ? parseFloat(b2bPrice) : null,
        })
      } catch {}
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setSaving(false)
    }
  }

  function updateMd(mp: string, patch: Partial<MarketplaceEntry>) {
    setMarketplaceData((prev) => ({ ...prev, [mp]: { ...(prev[mp] ?? {}), ...patch } }))
  }

  function toggleMp(m: string) {
    setMarketplaces((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.8 })
    if (!res.canceled && res.assets[0]) {
      setUploading(true)
      try {
        const asset = res.assets[0]
        const name = asset.fileName || `img_${Date.now()}.jpg`
        const up = await api.uploadImage(asset.uri, name, asset.mimeType || 'image/jpeg')
        if (up.url) setImages((prev) => [...prev, up.url])
      } catch (e: any) {
        Alert.alert(t('error'), e.message)
      } finally {
        setUploading(false)
      }
    }
  }

  async function handleAi(field: 'description' | 'title' | 'all') {
    try {
      const md = Object.values(marketplaceData)[0]
      const ctx = { name: label, brand: md?.brand || '', category: md?.category || '', price: parseFloat(price) || undefined }
      if (field === 'title' || field === 'all') {
        const r = await api.generateProductDescription({ ...ctx, field: 'title' })
        if (r.title) setLabel(r.title)
      }
      if (field === 'description' || field === 'all') {
        const r = await api.generateProductDescription({ ...ctx, field: 'description' })
        if (r.description) setDescription(r.description)
      }
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  async function handleImageAiEdit(index: number) {
    const url = images[index]?.trim()
    if (!url) { Alert.alert(t('error'), t('addImage')); return }
    setEditingImg(index)
    setImgPrompt('beyaz arka plan, profesyonel ürün fotoğrafı')
  }

  async function runImageAiEdit(index: number) {
    const url = images[index]?.trim()
    if (!url || !imgPrompt.trim()) return
    setUploading(true)
    try {
      const md = Object.values(marketplaceData)[0]
      const res = await api.editProductImage({ image_urls: [url], prompt: imgPrompt, category: md?.category || undefined })
      const sid = res.sessionId
      if (!sid) throw new Error('AI oturumu başlatılamadı')
      let files: string[] = []
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await api.getAiStatus(sid)
        if (st.ready && st.ready.length > 0) { files = st.ready; break }
      }
      if (files.length === 0) throw new Error(t('uploadImageDesc'))
      const outUrl = api.getAiOutputUrl(sid, files[0])
      const up = await api.uploadImage(outUrl, `ai_${Date.now()}.png`, 'image/png')
      if (up.url) {
        setImages((prev) => { const n = [...prev]; n[index] = up.url; return n })
      }
      setEditingImg(null); setImgPrompt('')
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally { setUploading(false) }
  }

  async function handleVerify(mp: string) {
    setVerifyingMp(mp)
    try {
      await api.verifyProduct(id, mp)
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setVerifyingMp(null) }
  }

  async function handleDelete() {
    try {
      await api.deleteAdminProduct(id)
      router.back()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>{t('productNotFound')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>&lt; {t('back')}</Text>
        </TouchableOpacity>
        <Logo width={90} height={24} />
        <Text style={styles.code}>#{product.code}</Text>
      </View>

      {editingImg !== null && (
        <View style={styles.card}>
          <Text style={styles.label}>{t('aiEdit')}: {images[editingImg] ? t('image') + ' ' + (editingImg + 1) : ''}</Text>
          <TextInput style={[styles.input, styles.textArea]} value={imgPrompt} onChangeText={setImgPrompt} multiline numberOfLines={2} placeholder={t('aiEditPromptPlaceholder')} />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => { setEditingImg(null); setImgPrompt('') }}>
              <Text style={styles.btnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.saveBtn, uploading && styles.disabled]} onPress={() => runImageAiEdit(editingImg)} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('start')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {images.length > 0 && (
        <ScrollView horizontal style={styles.gallery} showsHorizontalScrollIndicator={false}>
          {images.map((img: string, i: number) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.thumbActions}>
                <TouchableOpacity onPress={() => handleImageAiEdit(i)} disabled={uploading}>
                  <Text style={styles.thumbLink}>{t('aiEdit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Text style={styles.thumbLinkDel}>{t('delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.card}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('images')}</Text>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            <Text style={styles.linkBtn}>{uploading ? t('uploadImageDesc') : t('uploadFromDevice')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('productTitle')}</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('price')}</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t('stock')}</Text>
            <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('saleOnOwnSite')}</Text>
          <Switch value={status} onValueChange={setStatus} />
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('description')}</Text>
        </View>
        <View style={styles.labelBtns}>
          <TouchableOpacity style={styles.aiBtn} onPress={() => handleAi('description')} disabled={saving}>
            <Text style={styles.aiBtnText}>{t('aiGenerateDesc')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiBtn} onPress={() => handleAi('title')} disabled={saving}>
            <Text style={styles.aiBtnText}>{t('aiGenerateTitle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiBtn} onPress={() => handleAi('all')} disabled={saving}>
            <Text style={styles.aiBtnText}>{t('aiGenerateAll')}</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={4} />

        <TouchableOpacity style={[styles.btn, styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('selectMarketplaces')}</Text>
        <View style={styles.chips}>
          {['Kendi Sitem', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon'].map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, marketplaces.includes(m) && styles.chipActive]} onPress={() => toggleMp(m)}>
              <Text style={[styles.chipText, marketplaces.includes(m) && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {marketplaces.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('marketplaceDetails')}</Text>
          {marketplaces.map((m: string) => {
            const md: MarketplaceEntry = marketplaceData[m] ?? {}
            return (
              <View key={m} style={styles.mpItem}>
                <View style={styles.mpItemHead}>
                  <Text style={styles.mpItemName}>{m}</Text>
                  {m !== 'Kendi Sitem' && (
                    <TouchableOpacity onPress={() => handleVerify(m)} disabled={verifyingMp === m}>
                      <Text style={styles.linkBtn}>{verifyingMp === m ? t('verifying') : t('verify')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {m !== 'Kendi Sitem' && (
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>{t('saleOnThisMarketplace')}</Text>
                    <Switch value={!!md.on_sale} onValueChange={(v) => updateMd(m, { on_sale: v })} />
                  </View>
                )}
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('marketplaceCategory')}</Text>
                    <TextInput style={styles.input} value={md.category ?? ''} onChangeText={(v) => updateMd(m, { category: v })} />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('marketplaceBrand')}</Text>
                    <TextInput style={styles.input} value={md.brand ?? ''} onChangeText={(v) => updateMd(m, { brand: v })} />
                  </View>
                </View>
                {md.error ? <Text style={styles.syncError}>{md.error}</Text> : null}
              </View>
            )
          })}
        </View>
      )}

      <TouchableOpacity style={[styles.btn, styles.delBtn, saving && styles.disabled]} onPress={handleDelete} disabled={saving}>
        <Text style={styles.delBtnText}>{t('delete')}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('b2bEnabled')}</Text>
          <Switch value={b2bEnabled} onValueChange={setB2bEnabled} />
        </View>
        {b2bEnabled && (
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>{t('b2bDiscount')}</Text>
              <TextInput style={styles.input} value={b2bDiscount} onChangeText={setB2bDiscount} keyboardType="decimal-pad" placeholder="%" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>{t('b2bPrice')}</Text>
              <TextInput style={styles.input} value={b2bPrice} onChangeText={setB2bPrice} keyboardType="decimal-pad" placeholder="₺" />
            </View>
          </View>
        )}
      </View>
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
  gallery: { paddingHorizontal: 20, marginVertical: 8 },
  thumb: { width: 120, height: 120, borderRadius: 10, marginRight: 8, backgroundColor: '#e0e0e0' },
  thumbWrap: { marginRight: 8, alignItems: 'center' },
  thumbActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  thumbLink: { fontSize: 11, color: '#000', fontWeight: '600' },
  thumbLinkDel: { fontSize: 11, color: '#dc2626', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  labelBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aiBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  aiBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  linkBtn: { fontSize: 12, color: '#000', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  btn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: '#059669' },
  cancelBtn: { backgroundColor: '#666', flex: 1 },
  disabled: { opacity: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#000' },
  chipText: { color: '#555', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  mpItem: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 10 },
  mpItemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mpItemName: { fontSize: 14, fontWeight: '600' },
  syncRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  syncName: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  syncMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  syncError: { fontSize: 12, color: '#c62828', marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 4 },
  badgeOk: { backgroundColor: '#e8f5e9' },
  badgeWarn: { backgroundColor: '#fff3e0' },
  badgeErr: { backgroundColor: '#fce4ec' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  delBtn: { backgroundColor: '#fce4ec', marginHorizontal: 20, marginTop: 12, marginBottom: 30 },
  delBtnText: { color: '#c62828', fontSize: 16, fontWeight: '600' },
})

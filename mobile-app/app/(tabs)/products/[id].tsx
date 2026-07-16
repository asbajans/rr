import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import type { ProductDetail, MarketplaceData } from '../../../src/shared/types'

export default function ProductDetailScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<ProductDetail | null>(null)

  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [status, setStatus] = useState(true)
  const [description, setDescription] = useState('')

  async function load() {
    try {
      const res = await api.getAdminProduct(id)
      setProduct(res)
      setLabel(res.label ?? '')
      setPrice(res.price != null ? String(res.price) : '')
      setStock(res.stock != null ? String(res.stock) : '')
      setStatus(res.status === 1)
      setDescription(res.description ?? '')
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
      await api.updateAdminProduct(id, {
        label: label || undefined,
        price: price ? parseFloat(price) : undefined,
        stock: stock ? parseInt(stock, 10) : undefined,
        status: status ? 1 : 0,
        description: description || undefined,
      })
      Alert.alert(t('success'), t('productUpdated'))
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setSaving(false)
    }
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

  const images = product.images && product.images.length ? product.images : product.image ? [product.image] : []
  const marketplaces = product.marketplaces ?? []
  const marketplaceData = product.marketplace_data ?? {}

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>&lt; {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.code}>#{product.code}</Text>
      </View>

      {images.length > 0 && (
        <ScrollView horizontal style={styles.gallery} showsHorizontalScrollIndicator={false}>
          {images.map((img: string, i: number) => (
            <Image key={i} source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

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
          <Text style={styles.label}>{t('active')}</Text>
          <Switch value={status} onValueChange={setStatus} />
        </View>

        <Text style={styles.label}>{t('description')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={4} />

        <TouchableOpacity style={[styles.btn, styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      {marketplaces.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('marketplaces')}</Text>
          <View style={styles.chips}>
            {marketplaces.map((m: string) => (
              <View key={m} style={styles.chip}>
                <Text style={styles.chipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {marketplaces.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('syncStatus')}</Text>
          {marketplaces.map((m: string) => {
            const md: MarketplaceData = marketplaceData[m] ?? {}
            return (
              <View key={m} style={styles.syncRow}>
                <Text style={styles.syncName}>{m}</Text>
                <View style={[styles.badge, md.status === 'active' ? styles.badgeOk : md.status === 'rejected' ? styles.badgeErr : styles.badgeWarn]}>
                  <Text style={styles.badgeText}>{md.status ?? 'unknown'}</Text>
                </View>
                {md.category ? <Text style={styles.syncMeta}>{t('category')}: {md.category}</Text> : null}
                {md.brand ? <Text style={styles.syncMeta}>{t('brand')}: {md.brand}</Text> : null}
                {md.error ? <Text style={styles.syncError}>{md.error}</Text> : null}
              </View>
            )
          })}
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
  gallery: { paddingHorizontal: 20, marginVertical: 8 },
  thumb: { width: 120, height: 120, borderRadius: 10, marginRight: 8, backgroundColor: '#e0e0e0' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  btn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: '#059669' },
  disabled: { opacity: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#000', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  syncRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  syncName: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  syncMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  syncError: { fontSize: 12, color: '#c62828', marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 4 },
  badgeOk: { backgroundColor: '#e8f5e9' },
  badgeWarn: { backgroundColor: '#fff3e0' },
  badgeErr: { backgroundColor: '#fce4ec' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
})

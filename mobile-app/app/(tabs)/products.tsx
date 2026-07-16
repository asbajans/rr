import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, ScrollView, Modal, Image, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import { Logo } from '../../src/shared/components/Logo'
import type { Product, MarketplaceCategory, Category, MarketplaceEntry } from '../../src/shared/types'

const MARKETPLACE_OPTIONS = ['Kendi Sitem', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'Pazaryeri Yok']

type Filters = {
  marketplaces: string[]
  status: '' | '1' | '0'
  priceMin: string
  priceMax: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  synced: { bg: '#e8f5e9', color: '#2e7d32' },
  error: { bg: '#fce4ec', color: '#c62828' },
  pending: { bg: '#fff3e0', color: '#e65100' },
  none: { bg: '#eeeeee', color: '#666' },
}

export default function ProductsScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [perPage, setPerPage] = useState<number | 'all'>(25)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState<Filters>({ marketplaces: [], status: '', priceMin: '', priceMax: '' })

  const [marketplaceTrees, setMarketplaceTrees] = useState<Record<string, MarketplaceCategory[]>>({})
  const [categoriesFlat, setCategoriesFlat] = useState<Category[]>([])

  // modal
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [p, setP] = useState<{
    id: string
    code: string
    label: string
    price: string
    stock: string
    status: boolean
    description: string
    images: string[]
    marketplaces: string[]
    marketplace_data: Record<string, MarketplaceEntry>
    b2b_enabled?: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // bulk AI
  const [bulkAiOpen, setBulkAiOpen] = useState(false)
  const [bulkAiField, setBulkAiField] = useState<'title' | 'description' | 'all'>('description')
  const [selected, setSelected] = useState<string[]>([])

  function catOptionsFor(mp: string): { id: string; name: string }[] {
    if (mp === 'Kendi Sitem') {
      return (categoriesFlat ?? []).map((c) => ({ id: String(c.id), name: c.path || c.name }))
    }
    const tree = marketplaceTrees[mp] ?? []
    const opts: { id: string; name: string }[] = []
    const walk = (nodes: MarketplaceCategory[], prefix: string) => {
      nodes.forEach((n) => {
        const name = prefix ? `${prefix} / ${n.name}` : n.name
        opts.push({ id: String(n.marketplace_category_id ?? n.id), name })
        if (n.children?.length) walk(n.children, name)
      })
    }
    walk(tree, '')
    return opts
  }

  function brandsFor(mp: string): string[] {
    const set = new Set<string>()
    products.forEach((pr) => {
      const md = pr.marketplace_data?.[mp]
      if (md?.brand) set.add(md.brand)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }

  async function load() {
    try {
      const res = await api.getAdminProducts({ ...filters, page, perPage })
      setProducts(res.data)
      setTotal(res.total)
      setLastPage(res.last_page)
      setSelected([])
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [filters, page, perPage])

  useEffect(() => {
    const token = api.getToken()
    if (!token) return
    ;(async () => {
      try {
        const res = await api.getMarketplaceTrees()
        setMarketplaceTrees(res.trees ?? {})
      } catch {}
      try {
        const res = await api.getCategoriesFlat()
        setCategoriesFlat(res.data ?? [])
      } catch {}
    })()
  }, [])

  function toggleMarketplace(m: string) {
    setPage(1)
    setFilters((f) => ({
      ...f,
      marketplaces: f.marketplaces.includes(m) ? f.marketplaces.filter((x) => x !== m) : [...f.marketplaces, m],
    }))
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === products.length && products.length > 0 ? [] : products.map((x) => x.id)))
  }

  function openCreate() {
    setP({
      id: '', code: '', label: '', price: '', stock: '10', status: true,
      description: '',       images: [], marketplaces: [], marketplace_data: {}, b2b_enabled: false,
    })
    setCreating(true)
    setModalOpen(true)
  }

  function openEdit(item: Product) {
    setP({
      id: item.id,
      code: item.code,
      label: item.label,
      price: item.price != null ? String(item.price) : '',
      stock: item.stock != null ? String(item.stock) : '',
      status: item.status === 1,
      description: item.description ?? '',
      images: item.images && item.images.length ? item.images : (item.media_url ? [item.media_url] : []),
      marketplaces: item.marketplaces ?? [],
      marketplace_data: item.marketplace_data ?? {},
      b2b_enabled: item.b2b_enabled ?? false,
    })
    setCreating(false)
    setModalOpen(true)
    if (item.id) {
      api.getProductB2b(item.id).then((b) => {
        setP((prev) => prev ? { ...prev, b2b_enabled: !!b?.is_b2b_enabled } : prev)
      }).catch(() => {})
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Logo width={100} height={26} />
          <Text style={styles.title}>{t('products')}</Text>
          <Text style={styles.subtitle}>{total} {t('totalProducts')} · {products.filter((x) => x.status === 1).length} {t('onSale')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ {t('addProduct')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
        <TextInput
          style={styles.fInput}
          placeholder={t('priceMin')}
          keyboardType="decimal-pad"
          value={filters.priceMin}
          onChangeText={(v) => { setPage(1); setFilters((f) => ({ ...f, priceMin: v })) }}
        />
        <TextInput
          style={styles.fInput}
          placeholder={t('priceMax')}
          keyboardType="decimal-pad"
          value={filters.priceMax}
          onChangeText={(v) => { setPage(1); setFilters((f) => ({ ...f, priceMax: v })) }}
        />
        <TouchableOpacity
          style={[styles.fSelect, filters.status === '' && styles.fSelectActive]}
          onPress={() => { setPage(1); setFilters((f) => ({ ...f, status: '' })) }}
        >
          <Text style={styles.fSelectText}>{t('all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fSelect, filters.status === '1' && styles.fSelectActive]}
          onPress={() => { setPage(1); setFilters((f) => ({ ...f, status: '1' })) }}
        >
          <Text style={styles.fSelectText}>{t('onSale')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fSelect, filters.status === '0' && styles.fSelectActive]}
          onPress={() => { setPage(1); setFilters((f) => ({ ...f, status: '0' })) }}
        >
          <Text style={styles.fSelectText}>{t('notOnSale')}</Text>
        </TouchableOpacity>
        {MARKETPLACE_OPTIONS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.fChip, filters.marketplaces.includes(m) && styles.fChipActive]}
            onPress={() => toggleMarketplace(m)}
          >
            <Text style={[styles.fChipText, filters.marketplaces.includes(m) && styles.fChipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.pagerRow}>
        <View style={styles.pagerLeft}>
          <Text style={styles.pagerLabel}>{t('perPage')}:</Text>
          <TouchableOpacity style={styles.pagerSelect} onPress={() => {
            const opts = [25, 50, 100, 500, 'all'] as (number | 'all')[]
            const cur = opts.indexOf(perPage)
            const next = opts[(cur + 1) % opts.length]
            setPage(1); setPerPage(next)
          }}>
            <Text style={styles.pagerSelectText}>{perPage === 'all' ? t('all') : perPage}</Text>
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

      {selected.length > 0 && (
        <View style={styles.bulkRow}>
          <Text style={styles.bulkCount}>{selected.length} {t('selectedCount')}</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity style={styles.bulkB2bOpen} onPress={async () => {
              try {
                await api.bulkSetB2b(selected, true)
                Alert.alert(t('success'), t('b2bBulkDone')); load()
              } catch (e: any) { Alert.alert(t('error'), e.message) }
            }}>
              <Text style={styles.bulkB2bOpenText}>{t('b2bBulkOpen')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkB2bClose} onPress={async () => {
              try {
                await api.bulkSetB2b(selected, false)
                Alert.alert(t('success'), t('b2bBulkDone')); load()
              } catch (e: any) { Alert.alert(t('error'), e.message) }
            }}>
              <Text style={styles.bulkB2bCloseText}>{t('b2bBulkClose')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkDel} onPress={async () => {
              try {
                await api.deleteAdminProductsBulk(selected)
                setSelected([]); load()
              } catch (e: any) { Alert.alert(t('error'), e.message) }
            }}>
              <Text style={styles.bulkDelText}>{t('bulkDelete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('noOrders')}</Text>}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id)
            return (
              <View style={styles.card}>
                <TouchableOpacity style={styles.check} onPress={() => toggleSelect(item.id)}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/products/${item.id}`)}>
                  <View style={styles.cardText}>
                    <Text style={styles.productName}>{item.label}</Text>
                    <Text style={styles.productCode}>{item.code}</Text>
                  </View>
                  {item.media_url ? (
                    <Image source={{ uri: item.media_url }} style={styles.thumb} />
                  ) : null}
                  <View style={styles.cardMeta}>
                    <Text style={styles.price}>{item.price != null ? `${item.price} ₺` : '-'}</Text>
                    <Text style={styles.stock}>{item.stock ?? '-'}</Text>
                  </View>
                  <View style={styles.badges}>
                    {(item.marketplaces ?? []).map((m) => {
                      const sync = item.marketplace_sync?.[m]
                      const key = sync?.status ?? 'none'
                      const sc = STATUS_COLORS[key] ?? STATUS_COLORS.none
                      return (
                        <View key={m} style={[styles.mpBadge, { backgroundColor: m === 'Kendi Sitem' ? '#eee' : '#e8eaf6' }]}>
                          <View style={[styles.dot, { backgroundColor: sc.color }]} />
                          <Text style={styles.mpBadgeText}>{m}</Text>
                        </View>
                      )
                    })}
                    {(!item.marketplaces || item.marketplaces.length === 0) && <Text style={styles.muted}>-</Text>}
                  </View>
                  <View style={[styles.statusBadge, item.status === 1 ? styles.statusOn : styles.statusOff]}>
                    <Text style={[styles.statusText, item.status === 1 ? styles.statusOnText : styles.statusOffText]}>
                      {item.status === 1 ? t('onSale') : t('notOnSale')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.editBtnText}>{t('edit')}</Text>
                </TouchableOpacity>
              </View>
            )
          }}
          contentContainerStyle={styles.list}
        />
      )}

      {modalOpen && p && (
        <ProductModal
          product={p}
          creating={creating}
          categoriesFlat={categoriesFlat}
          marketplaceTrees={marketplaceTrees}
          catOptionsFor={catOptionsFor}
          brandsFor={brandsFor}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
          t={t}
        />
      )}

      {bulkAiOpen && (
        <Modal visible={bulkAiOpen} transparent animationType="slide" onRequestClose={() => setBulkAiOpen(false)}>
          <View style={styles.bulkModalOverlay}>
            <View style={styles.bulkModal}>
              <Text style={styles.modalTitle}>{t('bulkAi')}</Text>
              <Text style={styles.bulkSub}>{selected.length} {t('selectedCount')}</Text>
              {(['description', 'title', 'all'] as const).map((f) => (
                <TouchableOpacity key={f} style={styles.radioRow} onPress={() => setBulkAiField(f)}>
                  <View style={[styles.radio, bulkAiField === f && styles.radioOn]} />
                  <Text style={styles.radioText}>
                    {f === 'description' ? t('aiGenerateDesc') : f === 'title' ? t('aiGenerateTitle') : t('aiGenerateAll')}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setBulkAiOpen(false)}>
                  <Text style={styles.modalCancelText}>{t('close')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={async () => {
                  for (const id of selected) {
                    try {
                      const pr = products.find((x) => x.id === id)
                      const md = pr?.marketplace_data ? Object.values(pr.marketplace_data)[0] : undefined
                      const ctx = { name: pr?.label || '', brand: pr?.brand || md?.brand || '', category: md?.category || '', price: pr?.price }
                      if (bulkAiField === 'title' || bulkAiField === 'all') {
                        const r = await api.generateProductDescription({ ...ctx, field: 'title' })
                        if (r.title) await api.updateAdminProduct(id, { label: r.title })
                      }
                      if (bulkAiField === 'description' || bulkAiField === 'all') {
                        const r = await api.generateProductDescription({ ...ctx, field: 'description' })
                        if (r.description) await api.updateAdminProduct(id, { description: r.description })
                      }
                    } catch (e: any) {
                      Alert.alert(t('error'), e.message)
                    }
                  }
                  setBulkAiOpen(false); setSelected([]); load()
                }}>
                  <Text style={styles.modalSaveText}>{t('start')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
  }
}

function ProductModal({
  product, creating, categoriesFlat, marketplaceTrees, catOptionsFor, brandsFor, onClose, onSaved, t,
}: {
  product: {
    id: string; code: string; label: string; price: string; stock: string; status: boolean
    description: string; images: string[]; marketplaces: string[]; marketplace_data: Record<string, MarketplaceEntry>
    b2b_enabled?: boolean
  }
  creating: boolean
  categoriesFlat: Category[]
  marketplaceTrees: Record<string, MarketplaceCategory[]>
  catOptionsFor: (mp: string) => { id: string; name: string }[]
  brandsFor: (mp: string) => string[]
  onClose: () => void
  onSaved: () => void
  t: (k: string) => string
}) {
  const [p, setP] = useState(product)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [verifyingMp, setVerifyingMp] = useState<string | null>(null)

  function updateMd(mp: string, patch: Partial<MarketplaceEntry>) {
    setP((prev) => ({ ...prev, marketplace_data: { ...prev.marketplace_data, [mp]: { ...(prev.marketplace_data[mp] ?? {}), ...patch } } }))
  }

  function toggleMp(m: string) {
    setP((prev) => ({
      ...prev,
      marketplaces: prev.marketplaces.includes(m) ? prev.marketplaces.filter((x) => x !== m) : [...prev.marketplaces, m],
    }))
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.8 })
    if (!res.canceled && res.assets[0]) {
      setUploading(true)
      try {
        const asset = res.assets[0]
        const name = asset.fileName || `img_${Date.now()}.jpg`
        const mime = asset.mimeType || 'image/jpeg'
        const up = await api.uploadImage(asset.uri, name, mime)
        if (up.url) setP((prev) => ({ ...prev, images: [...prev.images, up.url] }))
      } catch (e: any) {
        Alert.alert(t('error'), e.message)
      } finally {
        setUploading(false)
      }
    }
  }

  async function handleAiDesc() {
    try {
      const md = Object.values(p.marketplace_data)[0]
      const r = await api.generateProductDescription({ name: p.label, brand: md?.brand || '', category: md?.category || '', price: parseFloat(p.price) || undefined, field: 'description' })
      if (r.description) setP((prev) => ({ ...prev, description: r.description! }))
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function handleAiTitle() {
    try {
      const md = Object.values(p.marketplace_data)[0]
      const r = await api.generateProductDescription({ name: p.label, brand: md?.brand || '', category: md?.category || '', price: parseFloat(p.price) || undefined, field: 'title' })
      if (r.title) setP((prev) => ({ ...prev, label: r.title! }))
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }
  async function handleAiAll() {
    try {
      const md = Object.values(p.marketplace_data)[0]
      const ctx = { name: p.label, brand: md?.brand || '', category: md?.category || '', price: parseFloat(p.price) || undefined }
      const [d, ti] = await Promise.all([
        api.generateProductDescription({ ...ctx, field: 'description' }),
        api.generateProductDescription({ ...ctx, field: 'title' }),
      ])
      setP((prev) => ({ ...prev, description: d.description ?? prev.description, label: ti.title ?? prev.label }))
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  async function handleVerify(mp: string) {
    if (!p.id) return
    setVerifyingMp(mp)
    try {
      await api.verifyProduct(p.id, mp)
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setVerifyingMp(null) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const marketplace_data: Record<string, MarketplaceEntry> = {}
      p.marketplaces.forEach((m) => {
        const md = p.marketplace_data[m] ?? {}
        marketplace_data[m] = {
          category: md.category ?? '',
          category_id: md.category_id ?? '',
          brand: md.brand ?? '',
          on_sale: m === 'Kendi Sitem' ? p.status : !!md.on_sale,
          status: m === 'Kendi Sitem' ? (p.status ? 1 : 0) : (md.on_sale ? 1 : 0),
        }
      })
      const imgs = p.images.map((s) => s.trim()).filter(Boolean)
      const payload: any = {
        label: p.label,
        price: parseFloat(p.price) || 0,
        stock: parseInt(p.stock, 10) || 0,
        status: p.status ? 1 : 0,
        marketplaces: p.marketplaces,
        marketplace_data,
      }
      if (p.code.trim()) payload.code = p.code.trim()
      if (imgs.length) payload.media_urls = imgs
      if (p.description.trim()) payload.description = p.description.trim()

      if (creating) {
        const code = p.code.trim() || `PRD-${Date.now()}`
        const created = await api.createAdminProduct({ ...payload, code })
        if (created?.id) {
          await api.updateProductB2b({ product_id: created.id, is_b2b_enabled: !!p.b2b_enabled })
        }
        Alert.alert(t('success'), t('productCreated'))
      } else {
        await api.updateAdminProduct(p.id, payload)
        await api.updateProductB2b({ product_id: p.id, is_b2b_enabled: !!p.b2b_enabled })
        Alert.alert(t('success'), t('productUpdated'))
      }
      onSaved()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!p.id) return
    try {
      await api.deleteAdminProduct(p.id)
      onSaved()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.modalScroll}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{creating ? t('addProduct') : t('editProduct')}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeX}>×</Text></TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('productCode')}</Text>
          <TextInput style={styles.input} value={p.code} onChangeText={(v) => setP({ ...p, code: v })} />

          <Text style={styles.label}>{t('title')}</Text>
          <TextInput style={styles.input} value={p.label} onChangeText={(v) => setP({ ...p, label: v })} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>{t('price')}</Text>
              <TextInput style={styles.input} value={p.price} onChangeText={(v) => setP({ ...p, price: v })} keyboardType="decimal-pad" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>{t('stock')}</Text>
              <TextInput style={styles.input} value={p.stock} onChangeText={(v) => setP({ ...p, stock: v })} keyboardType="number-pad" />
            </View>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('images')}</Text>
            <View style={styles.labelBtns}>
              <TouchableOpacity onPress={() => setP({ ...p, images: [...p.images, ''] })}>
                <Text style={styles.linkBtn}>+ {t('addImage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} disabled={uploading}>
                <Text style={styles.linkBtn}>{uploading ? t('uploadImageDesc') : t('uploadFromDevice')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {p.images.map((img, idx) => (
            <View key={idx} style={styles.imgRow}>
              <TextInput
                style={styles.imgInput}
                value={img}
                onChangeText={(v) => { const n = [...p.images]; n[idx] = v; setP({ ...p, images: n }) }}
                placeholder="https://..."
              />
              {img.trim() ? <Image source={{ uri: img }} style={styles.imgThumb} /> : null}
              <TouchableOpacity onPress={() => setP({ ...p, images: p.images.filter((_, i) => i !== idx) })}>
                <Text style={styles.delBtn}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('description')}</Text>
            <View style={styles.labelBtns}>
              <TouchableOpacity onPress={handleAiDesc}><Text style={styles.linkBtn}>{t('aiGenerateDesc')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAiTitle}><Text style={styles.linkBtn}>{t('aiGenerateTitle')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAiAll}><Text style={styles.linkBtn}>{t('aiGenerateAll')}</Text></TouchableOpacity>
            </View>
          </View>
          <TextInput style={[styles.input, styles.textArea]} value={p.description} onChangeText={(v) => setP({ ...p, description: v })} multiline numberOfLines={4} />

          <Text style={styles.label}>{t('selectMarketplaces')}</Text>
          <View style={styles.chipsWrap}>
            {MARKETPLACE_OPTIONS.filter((m) => m !== 'Pazaryeri Yok').map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.fChip, p.marketplaces.includes(m) && styles.fChipActive]}
                onPress={() => toggleMp(m)}
              >
                <Text style={[styles.fChipText, p.marketplaces.includes(m) && styles.fChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {p.marketplaces.length > 0 && (
            <View style={styles.mpDetailBox}>
              <Text style={styles.mpDetailTitle}>{t('marketplaceDetails')}</Text>
              {p.marketplaces.map((mp) => {
                const md = p.marketplace_data[mp] ?? {}
                const catOpts = catOptionsFor(mp)
                const brOpts = brandsFor(mp)
                return (
                  <View key={mp} style={styles.mpItem}>
                    <View style={styles.mpItemHead}>
                      <Text style={styles.mpItemName}>{mp}</Text>
                      {mp !== 'Kendi Sitem' && (
                        <TouchableOpacity onPress={() => handleVerify(mp)} disabled={verifyingMp === mp}>
                          <Text style={styles.linkBtn}>{verifyingMp === mp ? t('verifying') : t('verify')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {mp !== 'Kendi Sitem' && (
                      <View style={styles.switchRow}>
                        <Text style={styles.label}>{t('saleOnThisMarketplace')}</Text>
                        <Switch value={!!md.on_sale} onValueChange={(v) => updateMd(mp, { on_sale: v })} />
                      </View>
                    )}
                    <View style={styles.row}>
                      <View style={styles.half}>
                        <Text style={styles.label}>{t('marketplaceCategory')}</Text>
                        <TextInput
                          style={styles.input}
                          value={md.category ?? ''}
                          onChangeText={(v) => {
                            const match = catOpts.find((o) => o.name === v)
                            updateMd(mp, { category: v, category_id: match?.id ?? md.category_id ?? '' })
                          }}
                          placeholder={t('marketplaceCategory')}
                        />
                      </View>
                      <View style={styles.half}>
                        <Text style={styles.label}>{t('marketplaceBrand')}</Text>
                        <TextInput
                          style={styles.input}
                          value={md.brand ?? ''}
                          onChangeText={(v) => updateMd(mp, { brand: v })}
                          placeholder={t('marketplaceBrand')}
                        />
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.label}>{t('saleOnOwnSite')}</Text>
            <Switch value={p.status} onValueChange={(v) => setP({ ...p, status: v })} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>{t('b2bEnabled')}</Text>
            <Switch value={!!p.b2b_enabled} onValueChange={(v) => setP({ ...p, b2b_enabled: v })} />
          </View>
        </View>

        <View style={styles.modalActions}>
          {!creating && (
            <TouchableOpacity style={styles.delAction} onPress={handleDelete}>
              <Text style={styles.delActionText}>{t('delete')}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.modalActionsRight}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSave, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  addBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  filtersRow: { paddingHorizontal: 16, paddingBottom: 8 },
  fInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#fff', marginRight: 8, width: 90, height: 38, textAlignVertical: 'center', includeFontPadding: false },
  fSelect: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff', marginRight: 8, height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  fSelectActive: { backgroundColor: '#000', borderColor: '#000' },
  fSelectText: { fontSize: 13, color: '#333' },
  fChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, backgroundColor: '#fff', marginRight: 8, height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  fChipActive: { backgroundColor: '#000', borderColor: '#000' },
  fChipText: { fontSize: 12, color: '#333' },
  fChipTextActive: { color: '#fff', fontWeight: '600' },
  pagerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  pagerLeft: { flexDirection: 'row', alignItems: 'center' },
  pagerLabel: { fontSize: 13, color: '#666', marginRight: 6 },
  pagerSelect: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pagerSelectText: { fontSize: 13 },
  pagerRight: { flexDirection: 'row', alignItems: 'center' },
  pageBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pageBtnText: { fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#666', marginHorizontal: 8 },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  bulkCount: { fontSize: 13, fontWeight: '600' },
  bulkActions: { flexDirection: 'row', gap: 8 },
  bulkB2bOpen: { backgroundColor: '#000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bulkB2bOpenText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  bulkB2bClose: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bulkB2bCloseText: { fontSize: 13, color: '#000', fontWeight: '600' },
  bulkDel: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bulkDelText: { fontSize: 13, color: '#dc2626' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { padding: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#bbb', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#000', borderColor: '#000' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  productCode: { fontSize: 12, color: '#999' },
  thumb: { width: 44, height: 44, borderRadius: 8, marginTop: 6 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  price: { fontSize: 14, fontWeight: '600' },
  stock: { fontSize: 14, color: '#666' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  mpBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  mpBadgeText: { fontSize: 11, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  muted: { fontSize: 13, color: '#999' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  statusOn: { backgroundColor: '#e8f5e9' },
  statusOff: { backgroundColor: '#fce4ec' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusOnText: { color: '#2e7d32' },
  statusOffText: { color: '#c62828' },
  editBtn: { padding: 8 },
  editBtnText: { color: '#000', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  modalScroll: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeX: { fontSize: 28, color: '#999', lineHeight: 32 },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  labelBtns: { flexDirection: 'row', gap: 10 },
  linkBtn: { fontSize: 12, color: '#000', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  imgInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#fafafa' },
  imgThumb: { width: 36, height: 36, borderRadius: 6 },
  delBtn: { fontSize: 12, color: '#dc2626' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mpDetailBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginTop: 14 },
  mpDetailTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 8 },
  mpItem: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 10 },
  mpItemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mpItemName: { fontSize: 14, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalActionsRight: { flexDirection: 'row', gap: 10 },
  modalCancel: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18 },
  modalCancelText: { fontSize: 15 },
  modalSave: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 22, minWidth: 90, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  delAction: { paddingVertical: 12 },
  delActionText: { fontSize: 15, color: '#dc2626', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  bulkModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bulkModal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  bulkSub: { fontSize: 13, color: '#666', marginBottom: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#bbb' },
  radioOn: { backgroundColor: '#000', borderColor: '#000' },
  radioText: { fontSize: 15 },
})

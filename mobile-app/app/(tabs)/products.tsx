import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, ScrollView, Modal, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import type { Product } from '../../src/shared/types'

type AiAnalysis = {
  specs: { material: string; color: string; type: string; style: string; category: string }
  title: string
  description: string
  short_description: string
  slug: string
  meta_title: string
  meta_description: string
  keywords: string[]
}

export default function ProductsScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addStock, setAddStock] = useState('10')
  const [addSaving, setAddSaving] = useState(false)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiImage, setAiImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [aiCode, setAiCode] = useState('')
  const [aiLabel, setAiLabel] = useState('')
  const [aiPrice, setAiPrice] = useState('')
  const [aiStock, setAiStock] = useState('10')
  const [aiDescription, setAiDescription] = useState('')
  const [aiSaving, setAiSaving] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminProducts()
      setProducts(res.data)
      setTotal(res.total)
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

  async function handleAdd() {
    if (!addCode || !addLabel) {
      Alert.alert(t('error'), `${t('code')} & ${t('title')} gerekli`)
      return
    }
    setAddSaving(true)
    try {
      await api.createAdminProduct({
        code: addCode,
        label: addLabel,
        price: parseFloat(addPrice) || undefined,
        stock: parseInt(addStock) || undefined,
        status: 1,
      })
      Alert.alert(t('success'), t('productUpdated'))
      setAddOpen(false)
      setAddCode(''); setAddLabel(''); setAddPrice(''); setAddStock('10')
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setAddSaving(false)
    }
  }

  async function pickAiImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.8 })
    if (!res.canceled && res.assets[0]) {
      setAiImage(res.assets[0].uri)
      setAnalysis(null)
    }
  }

  async function handleAnalyze() {
    if (!aiImage) return
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('image', { uri: aiImage, type: 'image/jpeg', name: 'photo.jpg' } as any)
      const res = await api.analyzeProduct(formData)
      setAnalysis(res)
      setAiCode(res.slug || res.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32))
      setAiLabel(res.title)
      setAiDescription(res.description)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleAiCreate() {
    if (!aiCode || !aiLabel) {
      Alert.alert(t('error'), `${t('code')} & ${t('title')} gerekli`)
      return
    }
    setAiSaving(true)
    try {
      await api.createAdminProduct({
        code: aiCode,
        label: aiLabel,
        price: parseFloat(aiPrice) || undefined,
        stock: parseInt(aiStock) || undefined,
        status: 1,
      })
      Alert.alert(t('success'), t('productUpdated'))
      setAiOpen(false)
      setAiImage(null); setAnalysis(null)
      setAiCode(''); setAiLabel(''); setAiPrice(''); setAiStock('10'); setAiDescription('')
      load()
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setAiSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.count}>{total} {t('totalProducts')}</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.aiBtn} onPress={() => setAiOpen(true)}>
            <Text style={styles.aiBtnText}>{t('aiEasyAdd')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnText}>{t('addProduct')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/products/${item.id}`)}>
            <View style={styles.cardLeft}>
              <Text style={styles.productName}>{item.label}</Text>
              <Text style={styles.productCode}>{item.code}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.price}>{item.price ? `$${item.price}` : '-'}</Text>
              <Text style={[styles.status, item.status === 1 ? styles.active : styles.inactive]}>
                {item.status === 1 ? t('active') : t('inactive')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />

      <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <ScrollView style={styles.modalScroll}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('addProduct')}</Text>
            <TouchableOpacity onPress={() => setAddOpen(false)}><Text style={styles.closeX}>×</Text></TouchableOpacity>
          </View>
          <View style={styles.form}>
            <Text style={styles.label}>{t('code')}</Text>
            <TextInput style={styles.input} value={addCode} onChangeText={setAddCode} />
            <Text style={styles.label}>{t('title')}</Text>
            <TextInput style={styles.input} value={addLabel} onChangeText={setAddLabel} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>{t('price')}</Text>
                <TextInput style={styles.input} value={addPrice} onChangeText={setAddPrice} keyboardType="decimal-pad" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>{t('stock')}</Text>
                <TextInput style={styles.input} value={addStock} onChangeText={setAddStock} keyboardType="number-pad" />
              </View>
            </View>
            <TouchableOpacity style={[styles.saveBtn, addSaving && styles.disabled]} onPress={handleAdd} disabled={addSaving}>
              {addSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={aiOpen} animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <ScrollView style={styles.modalScroll}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('aiEasyAdd')}</Text>
            <TouchableOpacity onPress={() => setAiOpen(false)}><Text style={styles.closeX}>×</Text></TouchableOpacity>
          </View>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.btn} onPress={pickAiImage}>
              <Text style={styles.btnText}>{aiImage ? t('changeImage') : t('selectImage')}</Text>
            </TouchableOpacity>
            {aiImage && <Image source={{ uri: aiImage }} style={styles.preview} />}
            {aiImage && !analysis && (
              <TouchableOpacity style={[styles.btn, styles.analyzeBtn, analyzing && styles.disabled]} onPress={handleAnalyze} disabled={analyzing}>
                {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('analyzeWithAi')}</Text>}
              </TouchableOpacity>
            )}
            {analysis && (
              <View style={styles.form}>
                <Text style={styles.label}>{t('code')}</Text>
                <TextInput style={styles.input} value={aiCode} onChangeText={setAiCode} />
                <Text style={styles.label}>{t('title')}</Text>
                <TextInput style={styles.input} value={aiLabel} onChangeText={setAiLabel} />
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('price')}</Text>
                    <TextInput style={styles.input} value={aiPrice} onChangeText={setAiPrice} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>{t('stock')}</Text>
                    <TextInput style={styles.input} value={aiStock} onChangeText={setAiStock} keyboardType="number-pad" />
                  </View>
                </View>
                <Text style={styles.label}>{t('description')}</Text>
                <TextInput style={[styles.input, styles.textArea]} value={aiDescription} onChangeText={setAiDescription} multiline numberOfLines={4} />
                <Text style={styles.meta}>{t('detected')} {analysis.specs.category} / {analysis.specs.color}</Text>
                <TouchableOpacity style={[styles.saveBtn, aiSaving && styles.disabled]} onPress={handleAiCreate} disabled={aiSaving}>
                  {aiSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('createProduct')}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  aiBtn: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  aiBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  count: { fontSize: 14, color: '#666' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600' },
  productCode: { fontSize: 13, color: '#999', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  active: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  inactive: { backgroundColor: '#fce4ec', color: '#c62828' },
  modalScroll: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeX: { fontSize: 28, color: '#999', lineHeight: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 12 },
  form: { marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  btn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  analyzeBtn: { backgroundColor: '#059669' },
  preview: { width: '100%', height: 280, borderRadius: 12, marginBottom: 12 },
  meta: { fontSize: 13, color: '#666', marginTop: 8 },
  saveBtn: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
})

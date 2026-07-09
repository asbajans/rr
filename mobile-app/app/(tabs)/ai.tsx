import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api } from '../../src/shared/api-client'

type Tab = 'remove-bg' | 'creator'

interface AiAnalysis {
  specs: { material: string; color: string; type: string; style: string; category: string }
  title: string
  description: string
  short_description: string
  slug: string
  meta_title: string
  meta_description: string
  keywords: string[]
}

export default function AIScreen() {
  const [tab, setTab] = useState<Tab>('remove-bg')
  const [image, setImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  // Creator
  const [creatorImage, setCreatorImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [saving, setSaving] = useState(false)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('10')
  const [description, setDescription] = useState('')

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0].uri)
      setResultUrl(null)
    }
  }

  async function processImage() {
    if (!image) return
    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('image', { uri: image, type: 'image/jpeg', name: 'photo.jpg' } as any)
      const res = await api.processImage(formData)
      setResultUrl(res.url)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setProcessing(false)
    }
  }

  async function pickCreatorImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      setCreatorImage(res.assets[0].uri)
      setAnalysis(null)
    }
  }

  async function handleAnalyze() {
    if (!creatorImage) return
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('image', { uri: creatorImage, type: 'image/jpeg', name: 'photo.jpg' } as any)
      const res = await api.analyzeProduct(formData)
      setAnalysis(res)
      setCode(res.slug || res.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32))
      setLabel(res.title)
      setDescription(res.description)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCreate() {
    if (!code || !label) {
      Alert.alert('Error', 'Code and label are required')
      return
    }
    setSaving(true)
    try {
      const res = await api.createAdminProduct({
        code,
        label,
        price: parseFloat(price) || undefined,
        stock: parseInt(stock) || undefined,
        status: 1,
      })
      Alert.alert('Success', `Product created! ID: ${res.id}`)
      setAnalysis(null)
      setCreatorImage(null)
      setCode('')
      setLabel('')
      setPrice('')
      setStock('10')
      setDescription('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>AI Tools</Text>

      <View style={styles.tabs}>
        {(['remove-bg', 'creator'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'remove-bg' ? 'Remove BG' : 'Product Creator'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'remove-bg' && (
        <View style={styles.card}>
          <TouchableOpacity style={styles.btn} onPress={pickImage}>
            <Text style={styles.btnText}>{image ? 'Change Image' : 'Select Image'}</Text>
          </TouchableOpacity>

          {image && <Image source={{ uri: image }} style={styles.preview} />}

          {image && (
            <TouchableOpacity
              style={[styles.btn, styles.processBtn, processing && styles.disabled]}
              onPress={processImage} disabled={processing}
            >
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Process with AI</Text>}
            </TouchableOpacity>
          )}

          {resultUrl && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>Result:</Text>
              <Image source={{ uri: resultUrl }} style={styles.preview} />
            </View>
          )}
        </View>
      )}

      {tab === 'creator' && (
        <View style={styles.card}>
          <TouchableOpacity style={styles.btn} onPress={pickCreatorImage}>
            <Text style={styles.btnText}>{creatorImage ? 'Change Image' : 'Select Product Image'}</Text>
          </TouchableOpacity>

          {creatorImage && <Image source={{ uri: creatorImage }} style={styles.preview} />}

          {creatorImage && !analysis && (
            <TouchableOpacity
              style={[styles.btn, styles.analyzeBtn, analyzing && styles.disabled]}
              onPress={handleAnalyze} disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Analyze with AI</Text>
              )}
            </TouchableOpacity>
          )}

          {analyzing && <ActivityIndicator color="#000" style={{ marginTop: 20 }} />}

          {analysis && (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Product Details</Text>

              <Text style={styles.label}>Code</Text>
              <TextInput style={styles.input} value={code} onChangeText={setCode} />

              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={label} onChangeText={setLabel} />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Price (₺)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Stock</Text>
                  <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" />
                </View>
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={4} />

              <Text style={styles.label}>Detected: {analysis.specs.category} / {analysis.specs.color}</Text>

              <TouchableOpacity
                style={[styles.btn, styles.createBtn, saving && styles.disabled]}
                onPress={handleCreate} disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Product</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  tabs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e0e0e0', alignItems: 'center' },
  activeTab: { backgroundColor: '#000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  activeTabText: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  btn: {
    backgroundColor: '#000', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  processBtn: { backgroundColor: '#222' },
  analyzeBtn: { backgroundColor: '#059669' },
  createBtn: { backgroundColor: '#059669', marginTop: 8 },
  disabled: { opacity: 0.5 },
  preview: { width: '100%', height: 300, borderRadius: 12, marginBottom: 12 },
  resultSection: { marginTop: 12 },
  resultLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  form: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10,
    fontSize: 15, backgroundColor: '#fafafa',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
})

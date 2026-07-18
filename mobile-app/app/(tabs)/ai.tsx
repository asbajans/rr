import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Image, ScrollView, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../../src/shared/i18n'
import { api } from '../../../src/shared/api-client'
import type { Product } from '../../../src/shared/types'
import { Ionicons } from '@expo/vector-icons'

interface AiAnalysis {
  specs: { material: string; color: string; type: string; style: string; category: string }
  title: string
  description: string
  short_description: string
  meta_title: string
  meta_description: string
  keywords: string[]
  slug: string
}

export default function AiScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [tab, setTab] = useState<'analyze' | 'create'>('analyze')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [productForm, setProductForm] = useState({
    code: '',
    label: '',
    price: '',
    stock: '10',
    description: '',
  })

  async function pickImage(source: 'camera' | 'library') {
    const permissionResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      Alert.alert(t('error'), source === 'camera' ? 'Kamera izni gerekli' : 'Galeri izni gerekli')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setAnalysis(null)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
    }
  }

  async function takePhoto() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert(t('error'), 'Kamera izni gerekli')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setAnalysis(null)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
    }
  }

  async function handleAnalyze() {
    if (!imageUri) return
    setAnalyzing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image', {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      } as any)

      const res = await api.upload<AiAnalysis>('/api/ai/analyze-product', formData)
      setAnalysis(res)
      setProductForm({
        code: res.slug || res.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32),
        label: res.title,
        price: '',
        stock: '10',
        description: res.description,
      })
    } catch (err: any) {
      setError(err.message || t('analyzeFailed'))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCreateProduct() {
    if (!analysis || !productForm.label || !productForm.code) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.createAdminProduct({
        code: productForm.code,
        label: productForm.label,
        price: parseFloat(productForm.price) || undefined,
        stock: parseInt(productForm.stock) || undefined,
        status: 1,
        description: productForm.description,
      })
      setSuccess(`${t('productCreated')}! ID: ${res.id}`)
      setProductForm({ code: '', label: '', price: '', stock: '10', description: '' })
      setAnalysis(null)
      setImageUri(null)
    } catch (err: any) {
      setError(err.message || t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (tab === 'analyze') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="sparkles-outline" size={28} color="#10b981" />
          <Text style={styles.headerTitle}>{t('aiAnalyzeProduct')}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{t('aiAnalyzeSubtitle')}</Text>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
        {success && <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View>}

        <View style={styles.imageArea}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.imageActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.secondary]} onPress={() => setImageUri(null)}>
                  <Text style={styles.actionBtnText}>{t('changeImage')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#666" />
              <Text style={styles.placeholderText}>{t('selectImage')}</Text>
            </View>
          )}
        </View>

        {!imageUri && (
          <View style={styles.sourceButtons}>
            <TouchableOpacity style={styles.sourceBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.sourceBtnText}>{t('takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={() => pickImage('library')}>
              <Ionicons name="image-outline" size={24} color="#fff" />
              <Text style={styles.sourceBtnText}>{t('chooseFromGallery')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageUri && !analyzing && !analysis && (
          <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
            <Ionicons name="sparkles" size={22} color="#fff" />
            <Text style={styles.analyzeBtnText}>{t('analyzeProduct')}</Text>
          </TouchableOpacity>
        )}

        {analyzing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{t('analyzing')}</Text>
          </View>
        )}

        {analysis && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{t('analysisComplete')}</Text>
            <View style={styles.resultFields}>
              <Text style={styles.resultLabel}>{t('title')}: </Text>
              <Text style={styles.resultValue}>{analysis.title}</Text>
            </View>
            <View style={styles.resultFields}>
              <Text style={styles.resultLabel}>{t('category')}: </Text>
              <Text style={styles.resultValue}>{analysis.specs.category}</Text>
            </View>
            <View style={styles.resultFields}>
              <Text style={styles.resultLabel}>{t('color')}: </Text>
              <Text style={styles.resultValue}>{analysis.specs.color}</Text>
            </View>
            <View style={styles.resultFields}>
              <Text style={styles.resultLabel}>{t('material')}: </Text>
              <Text style={styles.resultValue}>{analysis.specs.material}</Text>
            </View>
            <TouchableOpacity style={styles.continueBtn} onPress={() => setTab('create')}>
              <Text style={styles.continueBtnText}>{t('continueToForm')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    )
  }

  // Create Product Tab
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="cube-outline" size={28} color="#3b82f6" />
        <Text style={styles.headerTitle}>{t('createProduct')}</Text>
      </View>
      <Text style={styles.headerSubtitle}>{t('editAndSave')}</Text>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
      {success && <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View>}

      {analysis && imageUri && (
        <Image source={{ uri: imageUri }} style={styles.smallPreview} />
      )}

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('code')}</Text>
          <TextInput
            style={styles.input}
            value={productForm.code}
            onChangeText={v => setProductForm({ ...productForm, code: v })}
            placeholder={t('codePlaceholder')}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('title')}</Text>
          <TextInput
            style={styles.input}
            value={productForm.label}
            onChangeText={v => setProductForm({ ...productForm, label: v })}
            placeholder={t('titlePlaceholder')}
          />
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('price')}</Text>
            <TextInput
              style={styles.input}
              value={productForm.price}
              onChangeText={v => setProductForm({ ...productForm, price: v })}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('stock')}</Text>
            <TextInput
              style={styles.input}
              value={productForm.stock}
              onChangeText={v => setProductForm({ ...productForm, stock: v })}
              keyboardType="numeric"
              placeholder="10"
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={productForm.description}
            onChangeText={v => setProductForm({ ...productForm, description: v })}
            placeholder={t('descPlaceholder')}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleCreateProduct} disabled={saving}>
          {saving ? (
            <>
              <ActivityIndicator size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{t('creatingProduct')}</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.saveBtnText}>{t('createProduct')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14 },
  successBox: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 12, marginBottom: 16 },
  successText: { color: '#16a34a', fontSize: 14 },
  imageArea: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 16 },
  previewImage: { width: '100%', height: 220 },
  uploadPlaceholder: { padding: 40, alignItems: 'center', backgroundColor: '#fff' },
  placeholderText: { marginTop: 8, fontSize: 14, color: '#999' },
  imageActions: { position: 'absolute', bottom: 12, right: 12 },
  actionBtn: { backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  secondary: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sourceButtons: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sourceBtn: { flex: 1, backgroundColor: '#000', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  sourceBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  analyzeBtn: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loadingBox: { alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  resultTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  resultFields: { flexDirection: 'row', marginBottom: 8 },
  resultLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  resultValue: { fontSize: 13, color: '#333', flex: 1 },
  continueBtn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  smallPreview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  field: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
})
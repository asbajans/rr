import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api } from '../../src/shared/api-client'

export default function AIScreen() {
  const [image, setImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      formData.append('image', {
        uri: image,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any)
      const res = await api.processImage(formData)
      setResultUrl(res.url)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
        <Text style={styles.uploadBtnText}>
          {image ? 'Change Image' : 'Select Image'}
        </Text>
      </TouchableOpacity>

      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}

      {image && (
        <TouchableOpacity
          style={[styles.processBtn, processing && styles.disabled]}
          onPress={processImage}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.processBtnText}>Process with AI</Text>
          )}
        </TouchableOpacity>
      )}

      {resultUrl && (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>Result:</Text>
          <Image source={{ uri: resultUrl }} style={styles.preview} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  uploadBtn: {
    backgroundColor: '#000', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginBottom: 20,
  },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  preview: { width: '100%', height: 300, borderRadius: 12, marginBottom: 20 },
  processBtn: {
    backgroundColor: '#000', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center',
  },
  processBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  result: { marginTop: 20 },
  resultLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
})

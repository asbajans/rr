import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '../../src/shared/auth'

export default function RegisterScreen() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert('Hata', 'Tüm alanları doldurun')
      return
    }
    setLoading(true)
    try {
      await register(name, email, password, storeName || undefined)
    } catch (e: any) {
      Alert.alert('Kayıt Başarısız', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>Rahatio'ya hoş geldin</Text>

        <TextInput
          style={styles.input}
          placeholder="Ad Soyad"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Mağaza Adı (isteğe bağlı)"
          placeholderTextColor="#999"
          value={storeName}
          onChangeText={setStoreName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre (en az 8 karakter)"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kaydol</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Zaten hesabın var mı? Giriş Yap</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    marginBottom: 16, backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#000', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
})

import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '../../src/shared/auth'
import { useI18n, LOCALES } from '../../src/shared/i18n'

export default function RegisterScreen() {
  const { register } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert(t('error'), `${t('name')}, ${t('email')} & ${t('password')} gerekli`)
      return
    }
    setLoading(true)
    try {
      await register(name, email, password, storeName || undefined)
    } catch (e: any) {
      Alert.alert(t('register'), e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text style={styles.title}>Rahatio</Text>
        <Text style={styles.subtitle}>{t('register')}</Text>

        <View style={styles.langRow}>
          {LOCALES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langChip, l.code === locale && styles.langChipActive]}
              onPress={() => setLocale(l.code)}
            >
              <Text style={[styles.langChipText, l.code === locale && styles.langChipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput style={styles.input} placeholder={t('name')} placeholderTextColor="#999" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder={`${t('store')} (${t('optional' as any) || 'opsiyonel'})`} placeholderTextColor="#999" value={storeName} onChangeText={setStoreName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder={t('password')} placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('register')}</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>{t('alreadyHaveAccount')}</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  langChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f0f0f0' },
  langChipActive: { backgroundColor: '#059669' },
  langChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  langChipTextActive: { color: '#fff' },
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

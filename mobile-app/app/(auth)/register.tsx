import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { useAuth } from '../../src/shared/auth'
import { useI18n, LOCALES } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'

WebBrowser.maybeCompleteAuthSession()

export default function RegisterScreen() {
  const { register, googleLogin } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string | null } | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    api.getGoogleConfig().then(setGoogleConfig).catch(() => setGoogleConfig({ enabled: false, clientId: null }))
  }, [])

  const [googleRequest, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest(
    googleConfig?.clientId ? { clientId: googleConfig.clientId } : undefined as any
  )

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = (googleResponse as any).params?.id_token || (googleResponse as any).authentication?.idToken
      const accessToken = (googleResponse as any).authentication?.accessToken
      if (idToken || accessToken) {
        setGoogleLoading(true)
        googleLogin(idToken || '', accessToken)
          .catch((e: any) => Alert.alert(t('register'), e.message || 'Google ile kayıt başarısız'))
          .finally(() => setGoogleLoading(false))
      }
    } else if (googleResponse?.type === 'error') {
      Alert.alert(t('error'), (googleResponse as any).error?.message || 'Google ile kayıt başarısız')
    }
  }, [googleResponse, googleLogin, t])

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert(t('error'), `${t('name')}, ${t('email')} & ${t('password')} ${t('required')}`)
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

  async function handleGoogle() {
    if (!googleConfig?.enabled || !googleConfig?.clientId) {
      Alert.alert(t('error'), 'Google ile kayıt şu anda yapılandırılmadı')
      return
    }
    if (!googleRequest) {
      Alert.alert(t('error'), 'Google isteği hazırlanıyor')
      return
    }
    try { await googlePrompt() } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Image source={require('../../assets/logo.jpeg')} style={styles.logo} resizeMode="contain" />
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
        <TextInput style={styles.input} placeholder={`${t('store')} (${t('optional')})`} placeholderTextColor="#999" value={storeName} onChangeText={setStoreName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder={t('password')} placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('register')}</Text>}
        </TouchableOpacity>

        {googleConfig?.enabled && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading || !googleRequest}>
              {googleLoading ? <ActivityIndicator color="#4285F4" /> : <Text style={styles.googleBtnText}>Google ile Kaydol</Text>}
            </TouchableOpacity>
          </>
        )}

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
  logo: { width: 200, height: 56, alignSelf: 'center', marginBottom: 8 },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e5e5' },
  dividerText: { fontSize: 12, color: '#999' },
  googleBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  googleBtnText: { color: '#333', fontSize: 15, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
})

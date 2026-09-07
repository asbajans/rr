import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { useAuth } from '../../src/shared/auth'
import { useI18n, LOCALES } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'

WebBrowser.maybeCompleteAuthSession()

type GoogleConfig = {
  enabled: boolean
  clientId: string | null
  clientIds: string[]
  webClientId: string | null
  androidClientId: string | null
  iosClientId: string | null
  expoClientId: string | null
}

export default function RegisterScreen() {
  const { register, googleLogin } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [googleError, setGoogleError] = useState<string | null>(null)

  useEffect(() => {
    console.log('[google] fetching /api/auth/google/config')
    api
      .getGoogleConfig()
      .then((cfg) => {
        console.log('[google] config', cfg)
        setGoogleConfig(cfg as GoogleConfig)
      })
      .catch((e: any) => {
        console.warn('[google] config fetch failed', e?.message || e)
        setGoogleError(e?.message || 'fetch failed')
        setGoogleConfig({ enabled: false, clientId: null, clientIds: [], webClientId: null, androidClientId: null, iosClientId: null, expoClientId: null })
      })
  }, [])

  const googleAuthConfig = useMemo(() => {
    if (!googleConfig?.enabled) {
      return { clientId: '000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com' } as any
    }
    const cfg: Record<string, string> = {}
    if (googleConfig.iosClientId) cfg.iosClientId = googleConfig.iosClientId
    if (googleConfig.androidClientId) cfg.androidClientId = googleConfig.androidClientId
    const webId = googleConfig.webClientId || googleConfig.expoClientId || googleConfig.clientId
    if (webId) cfg.webClientId = webId
    const fallbackId = googleConfig.clientId || googleConfig.webClientId || googleConfig.expoClientId
    if (fallbackId) cfg.clientId = fallbackId
    if (!cfg.clientId) {
      cfg.clientId = cfg.webClientId || cfg.androidClientId || cfg.iosClientId || '000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com'
    }
    return cfg as any
  }, [googleConfig])

  const [googleRequest, googleResponse, googlePrompt] = Google.useAuthRequest(googleAuthConfig)

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const auth: any = (googleResponse as any).authentication
      const params: any = (googleResponse as any).params
      const idToken: string = auth?.idToken || params?.id_token || ''
      const accessToken: string = auth?.accessToken || params?.access_token || ''
      if (idToken || accessToken) {
        setGoogleLoading(true)
        googleLogin(idToken || '', accessToken || undefined)
          .catch((e: any) => Alert.alert(t('register'), e.message || 'Google ile kayıt başarısız'))
          .finally(() => setGoogleLoading(false))
      } else {
        Alert.alert(t('error'), 'Google token alınamadı. Lütfen tekrar deneyin.')
      }
    } else if (googleResponse?.type === 'error') {
      const err: any = googleResponse as any
      const msg = err?.error?.message || err?.params?.error_description || 'Google ile kayıt başarısız'
      Alert.alert(t('error'), msg)
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
    const hasAnyId = !!(googleConfig?.clientId || googleConfig?.webClientId || googleConfig?.androidClientId || googleConfig?.iosClientId)
    if (!googleConfig?.enabled || !hasAnyId) {
      Alert.alert(t('error'), 'Google ile kayıt şu anda yapılandırılmadı')
      return
    }
    if (!googleRequest) {
      Alert.alert(t('error'), 'Google isteği hazırlanıyor')
      return
    }
    try {
      await googlePrompt()
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Google penceresi açılamadı')
    }
  }

  const googleReady = !!googleRequest && !googleLoading
  const showGoogle = googleConfig === null ? null : !!googleConfig.enabled

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

        {showGoogle === null ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={[styles.googleBtn, styles.googleBtnDisabled]}>
              <ActivityIndicator color="#4285F4" size="small" />
              <Text style={[styles.googleBtnText, { marginLeft: 8 }]}>Google yükleniyor…</Text>
            </View>
          </>
        ) : showGoogle ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity style={[styles.googleBtn, !googleReady && styles.googleBtnDisabled]} onPress={handleGoogle} disabled={!googleReady}>
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <View style={styles.googleBtnInner}>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Google ile Kaydol</Text>
                </View>
              )}
            </TouchableOpacity>
            {!googleRequest && <Text style={styles.googleHint}>Google hazırlanıyor…</Text>}
          </>
        ) : __DEV__ && googleError ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={[styles.googleBtn, styles.googleBtnDisabled]}>
              <Text style={styles.googleBtnText}>Google kapalı</Text>
            </View>
            <Text style={styles.googleHint}>Hata: {googleError} — API_BASE kontrol edin</Text>
          </>
        ) : null}

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
  googleBtnDisabled: { opacity: 0.6 },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  googleIcon: { color: '#4285F4', fontSize: 16, fontWeight: '700', width: 18, textAlign: 'center' },
  googleBtnText: { color: '#333', fontSize: 15, fontWeight: '600' },
  googleHint: { marginTop: 8, textAlign: 'center', fontSize: 11, color: '#999' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
})

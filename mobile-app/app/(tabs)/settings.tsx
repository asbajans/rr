import { useAuth } from '../../src/shared/auth'
import { api } from '../../src/shared/api-client'
import { useI18n } from '../../src/shared/i18n'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'

const THEMES = [
  { id: 'theme-001', name: 'Amber Onyx', primary: '#f59e0b', bg: '#1a1a1a', accent: '#f59e0b' },
  { id: 'theme-002', name: 'Teal Clean', primary: '#14b8a6', bg: '#ffffff', accent: '#0f766e' },
  { id: 'theme-014', name: 'Walnut Cream', primary: '#92400e', bg: '#fef3c7', accent: '#d97706' },
  { id: 'theme-027', name: 'Forest Fresh', primary: '#15803d', bg: '#f0fdf4', accent: '#16a34a' },
  { id: 'theme-052', name: 'Pure Dark', primary: '#000000', bg: '#000000', accent: '#ffffff' },
  { id: 'theme-069', name: 'Mono Night', primary: '#27272a', bg: '#18181b', accent: '#a1a1aa' },
]

const MP_LABELS: Record<string, string> = {
  trendyol: 'Trendyol', hepsiburada: 'Hepsiburada', pazarama: 'Pazarama',
  n11: 'N11', amazon: 'Amazon', etsy: 'Etsy', facebook: 'Facebook', instagram: 'Instagram',
}

function DomainManagerMobile() {
  const { t } = useI18n()
  const [domains, setDomains] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [dnsOpen, setDnsOpen] = useState<string | null>(null)
  const [dnsRecords, setDnsRecords] = useState<Record<string, any[]>>({})
  const [dnsLoading, setDnsLoading] = useState<string | null>(null)
  const [newDns, setNewDns] = useState<Record<string, { type: string; name: string; content: string }>>({})

  const load = async () => {
    try {
      const r: any = await api.getSiteDomains()
      setDomains(r.domains || [])
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')
    if (!d) return
    if (domains.length >= 5) { Alert.alert(t('error'), 'En fazla 5 domain'); return }
    setAdding(true)
    try {
      const r: any = await api.addSiteDomain(d)
      setDomains(r.domains || [])
      setInput('')
      Alert.alert(t('success'), 'Domain eklendi — NS’i değiştirip doğrulayın')
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setAdding(false) }
  }
  const handleVerify = async (domain: string) => {
    setVerifying(domain)
    try {
      const r: any = await api.verifySiteDomain(domain)
      setDomains(r.domains || [])
      Alert.alert(r.verified ? t('success') : t('error'), r.verified ? `${domain} doğrulandı` : `${domain} doğrulanamadı — NS’i kontrol edin`)
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setVerifying(null) }
  }
  const handleDelete = async (domain: string) => {
    Alert.alert(t('delete'), `${domain} silinsin mi?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try { const r: any = await api.removeSiteDomain(domain); setDomains(r.domains || []) } catch (e: any) { Alert.alert(t('error'), e.message) }
      }},
    ])
  }
  const toggleDns = async (domain: string) => {
    if (dnsOpen === domain) { setDnsOpen(null); return }
    setDnsOpen(domain)
    setDnsLoading(domain)
    try {
      const r: any = await api.listDomainDns(domain)
      setDnsRecords(prev => ({ ...prev, [domain]: r.records || [] }))
    } catch (e: any) {
      if (String(e.message).includes('NO_ZONE')) {
        try {
          const z: any = await api.createDomainZone(domain)
          Alert.alert(t('success'), `Zone oluşturuldu — NS: ${z.nameServers?.join(', ')}`)
          const r2: any = await api.listDomainDns(domain)
          setDnsRecords(prev => ({ ...prev, [domain]: r2.records || [] }))
        } catch (err: any) { Alert.alert(t('error'), err.message) }
      } else Alert.alert(t('error'), e.message)
    } finally { setDnsLoading(null) }
  }
  const handleCreateDns = async (domain: string) => {
    const f = newDns[domain] || { type: 'A', name: '', content: '' }
    if (!f.name.trim() || !f.content.trim()) { Alert.alert(t('error'), t('required')); return }
    try {
      await api.createDomainDns(domain, { type: f.type, name: f.name.trim(), content: f.content.trim() })
      const r: any = await api.listDomainDns(domain)
      setDnsRecords(prev => ({ ...prev, [domain]: r.records || [] }))
      setNewDns(prev => ({ ...prev, [domain]: { type: 'A', name: '', content: '' } }))
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  if (loading) return <View style={{ padding: 12 }}><ActivityIndicator /></View>
  return (
    <View style={[styles.guideBox, { marginTop: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ionicons name="globe-outline" size={16} color="#000" />
        <Text style={styles.guideTitle}>Domainler (max 5)</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={input} onChangeText={setInput} placeholder="ornek.com.tr" autoCapitalize="none" placeholderTextColor="#999" />
        <TouchableOpacity style={[styles.saveBtn, { paddingHorizontal: 14, marginTop: 0 }]} onPress={handleAdd} disabled={adding || !input.trim()}>
          {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Ekle</Text>}
        </TouchableOpacity>
      </View>
      {domains.length === 0 ? <Text style={[styles.meta, { marginTop: 8 }]}>Henüz domain yok</Text> : domains.map((d: any) => (
        <View key={d.domain} style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: d.verified ? '#bbf7d0' : '#fde68a', padding: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'monospace', fontWeight: '700', flex: 1 }} numberOfLines={1}>{d.domain}</Text>
            <View style={{ backgroundColor: d.verified ? '#dcfce7' : '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: d.verified ? '#15803d' : '#92400e' }}>{d.verified ? 'Doğrulandı' : 'Bekliyor'}</Text>
            </View>
          </View>
          {d.zoneId && <Text style={styles.meta}>Zone: {String(d.zoneId).slice(0, 8)}... {d.zoneStatus || ''}</Text>}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: d.verified ? '#fff' : '#111', borderWidth: 1, borderColor: d.verified ? '#ddd' : '#111', flex: 1 }]} onPress={() => handleVerify(d.domain)} disabled={verifying === d.domain}>
              {verifying === d.domain ? <ActivityIndicator size="small" /> : <Text style={[styles.saveBtnText, { color: d.verified ? '#111' : '#fff' }]}>{d.verified ? 'Tekrar Doğrula' : 'Doğrula'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', flex: 1 }]} onPress={() => handleDelete(d.domain)}>
              <Text style={[styles.saveBtnText, { color: '#dc2626' }]}>Sil</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => toggleDns(d.domain)}>
            <Ionicons name="settings-outline" size={14} color="#2563eb" />
            <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600' }}>{dnsOpen === d.domain ? 'DNS Kapat' : 'DNS Yönetimi'}</Text>
          </TouchableOpacity>
          {dnsOpen === d.domain && (
            <View style={{ marginTop: 8 }}>
              {dnsLoading === d.domain ? <ActivityIndicator size="small" /> : (
                <>
                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
                    <TextInput style={[styles.input, { flex: 0.6, marginBottom: 0, paddingVertical: 6 }]} value={(newDns[d.domain]?.type) || 'A'} onChangeText={(v) => setNewDns(prev => ({ ...prev, [d.domain]: { ...(prev[d.domain] || { type: 'A', name: '', content: '' }), type: v.toUpperCase() } }))} placeholder="A" autoCapitalize="characters" />
                    <TextInput style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 6 }]} value={newDns[d.domain]?.name || ''} onChangeText={(v) => setNewDns(prev => ({ ...prev, [d.domain]: { ...(prev[d.domain] || { type: 'A', name: '', content: '' }), name: v } }))} placeholder="@" />
                    <TextInput style={[styles.input, { flex: 1.5, marginBottom: 0, paddingVertical: 6 }]} value={newDns[d.domain]?.content || ''} onChangeText={(v) => setNewDns(prev => ({ ...prev, [d.domain]: { ...(prev[d.domain] || { type: 'A', name: '', content: '' }), content: v } }))} placeholder="1.2.3.4" />
                  </View>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#111', paddingVertical: 8 }]} onPress={() => handleCreateDns(d.domain)}>
                    <Text style={styles.saveBtnText}>Ekle</Text>
                  </TouchableOpacity>
                  {(dnsRecords[d.domain] || []).length === 0 ? <Text style={[styles.meta, { marginTop: 6 }]}>Kayıt yok</Text> : (dnsRecords[d.domain] || []).map((r: any) => (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#f9fafb', padding: 6, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', width: 36 }}>{r.type}</Text>
                      <Text style={{ fontSize: 10, flex: 1 }} numberOfLines={1}>{r.name}</Text>
                      <Text style={{ fontSize: 10, flex: 1.2 }} numberOfLines={1}>{r.content}</Text>
                      <TouchableOpacity onPress={async () => { try { await api.deleteDomainDns(d.domain, r.id); const nr: any = await api.listDomainDns(d.domain); setDnsRecords(prev => ({ ...prev, [d.domain]: nr.records || [] })) } catch (e: any) { Alert.alert(t('error'), e.message) } }}>
                        <Ionicons name="trash-outline" size={14} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  )
}

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [settings, setSettings] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [webSaving, setWebSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [allIntegrations, setAllIntegrations] = useState<any[]>([])
  const [expandedMp, setExpandedMp] = useState<string | null>(null)
  const [mpDetails, setMpDetails] = useState<Record<string, any>>({})
  const [mpSaving, setMpSaving] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [themeSaving, setThemeSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  async function load() {
    try {
      const s: any = await api.getSettings()
      setSettings(s)
      setName(s.name || '')
      setEmail(s.email || '')
      setSiteCode(s.site_code || s.siteCode || '')
      setDomain(s.domain || '')
      if (s.theme?.templateId) setSelectedTheme(s.theme.templateId)
      else if (s.theme?.template_id) setSelectedTheme(s.theme.template_id)
    } catch {}
  }

  useEffect(() => { load(); loadIntegrations() }, [])

  async function loadIntegrations() {
    try {
      const list = await api.getMarketplaceIntegrations()
      setAllIntegrations(list)
      setIntegrations(list.filter((i: any) => i.isActive))
    } catch { setIntegrations([]); setAllIntegrations([]) }
  }

  async function handleMpExpand(mp: string) {
    if (expandedMp === mp) { setExpandedMp(null); return }
    setExpandedMp(mp)
    if (!mpDetails[mp]) {
      try {
        const det = await api.getIntegration(mp)
        setMpDetails(prev => ({ ...prev, [mp]: det }))
      } catch { setMpDetails(prev => ({ ...prev, [mp]: { error: 'Yüklenemedi' } })) }
    }
  }

  async function handleMpSave(mp: string) {
    const det = mpDetails[mp]
    if (!det) return
    const fields = det.fields || {}
    const cfg = det.config || {}
    const requiredKeys = Object.entries(fields).filter(([k, label]: any) => !String(label).toLowerCase().includes('opsiyonel')).map(([k]) => k)
    const missing = requiredKeys.filter(k => !String(cfg[k] || '').trim())
    if (missing.length > 0) {
      Alert.alert(t('error'), `${t('required')}: ${missing.join(', ')}`)
      return
    }
    const hasAnyRequired = requiredKeys.length === 0 ? Object.keys(fields).some(k => String(cfg[k] || '').trim()) : requiredKeys.some(k => String(cfg[k] || '').trim())
    if (!hasAnyRequired) {
      Alert.alert(t('error'), t('noFields'))
      return
    }
    setMpSaving(mp)
    try {
      const payload: Record<string, any> = {}
      Object.keys(fields).forEach(k => { payload[k] = cfg[k] || '' })
      const isActive = missing.length === 0 && hasAnyRequired
      await api.updateIntegration(mp, { isActive, config: payload })
      Alert.alert(t('success'), isActive ? t('integrationSaved') : t('integrationSavedInactive'))
      loadIntegrations()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setMpSaving(null) }
  }

  async function handleMpDelete(mp: string) {
    const label = MP_LABELS[mp] || mp
    Alert.alert(t('deleteIntegration'), `${label} ${t('confirmDeleteIntegrationDesc')}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          await api.deleteIntegration(mp)
          Alert.alert(t('success'), `${label} ${t('integrationRemoved')}`)
          setMpDetails(prev => { const n = { ...prev }; delete n[mp]; return n })
          if (expandedMp === mp) setExpandedMp(null)
          loadIntegrations()
        } catch (e: any) { Alert.alert(t('error'), e.message || 'Silinemedi') }
      }},
    ])
  }

  async function handleOAuth(mp: string) {
    try {
      const urlRes: any = mp === 'amazon' ? await api.getAmazonOAuthUrl() : await api.getEtsyOAuthUrl()
      const url = urlRes.url
      if (!url) throw new Error('URL alınamadı')
      await WebBrowser.openBrowserAsync(url)
    } catch (e: any) { Alert.alert(t('error'), e.message) }
  }

  async function syncAllProducts() {
    if (integrations.length === 0) {
      Alert.alert(t('error'), 'Aktif pazaryeri entegrasyonu yok')
      return
    }
    setSyncing(true)
    try {
      let total = 0
      for (const ig of integrations) {
        try { const res = await api.syncAllToMarketplace(ig.marketplace); total += res.enqueued || 0 } catch {}
      }
      Alert.alert(t('success'), total > 0 ? `${total} ürün senkronizasyon kuyruğuna eklendi` : 'Senkronize edilecek ürün yok')
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setSyncing(false) }
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated: any = await api.updateSettings({ name: name.trim(), email: email.trim() || undefined })
      setSettings(updated)
      Alert.alert(t('success'), t('settingsUpdated'))
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setSaving(false) }
  }

  async function saveWebsite() {
    if (!siteCode.trim()) { Alert.alert(t('error'), t('required')); return }
    setWebSaving(true)
    try {
      if (settings && siteCode.trim().toLowerCase() !== String(settings.site_code || settings.siteCode || '').toLowerCase()) {
        const chk = await api.checkSiteCode(siteCode.trim().toLowerCase())
        if (!chk.available) { Alert.alert(t('error'), 'Bu site adresi başka bir mağaza tarafından kullanılıyor'); setWebSaving(false); return }
      }
      const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
      const payload: any = { site_code: siteCode.trim().toLowerCase() }
      if (d) { payload.domain = d; payload.siteUrl = `https://${d}` }
      else { payload.domain = null; payload.siteUrl = null }
      const updated: any = await api.updateSettings(payload)
      setSettings(updated)
      Alert.alert(t('success'), t('websiteSaved'))
    } catch (e: any) { Alert.alert(t('error'), e.message || 'Kaydedilemedi') }
    finally { setWebSaving(false) }
  }

  async function saveTheme() {
    if (!selectedTheme) return
    setThemeSaving(true)
    try {
      const preset = THEMES.find(t => t.id === selectedTheme)
      const themeObj: any = preset ? { templateId: preset.id, primary_color: preset.primary, bg: preset.bg, accent: preset.accent } : { templateId: selectedTheme }
      await api.updateSettings({ theme: themeObj } as any)
      Alert.alert(t('success'), t('themeSaved'))
      load()
    } catch (e: any) { Alert.alert(t('error'), e.message) }
    finally { setThemeSaving(false) }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 8) { Alert.alert(t('error'), t('passwordMinLength')); return }
    if (newPassword !== confirmPassword) { Alert.alert(t('error'), t('passwordsNotMatch')); return }
    setPwLoading(true)
    try {
      await api.changePassword(currentPassword || undefined, newPassword)
      Alert.alert(t('success'), t('passwordUpdated'))
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e: any) { Alert.alert(t('error'), e.message || t('error')) }
    finally { setPwLoading(false) }
  }

  const storeUrl = settings?.site_code ? `https://rahatio.com.tr/stores/${settings.site_code}` : null
  const customUrl = settings?.domain ? `https://${settings.domain}` : null
  const primaryUrl = customUrl || storeUrl
  const theme = settings?.theme || null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="storefront-outline" size={20} color="#000" /><Text style={styles.sectionTitle}>{t('storeSettings')}</Text></View>
        <Text style={styles.label}>{t('storeName')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('storeName')} placeholderTextColor="#999" />
        <Text style={styles.label}>E-posta</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="magaza@ornek.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#999" />
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('saveChanges')}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="globe-outline" size={20} color="#2563eb" /><Text style={styles.sectionTitle}>{t('website')}</Text></View>
        <Text style={styles.helper}>{t('websiteDesc')}</Text>
        <Text style={styles.label}>{t('siteCodeLabel')}</Text>
        <TextInput style={styles.input} value={siteCode} onChangeText={setSiteCode} placeholder="ornek-magaza" autoCapitalize="none" placeholderTextColor="#999" />
        {storeUrl && <TouchableOpacity onPress={() => Linking.openURL(storeUrl)} style={styles.linkRow}><Ionicons name="link-outline" size={16} color="#2563eb" /><Text style={styles.linkText} numberOfLines={1}>{storeUrl}</Text></TouchableOpacity>}

        <Text style={styles.label}>{t('customDomain')}</Text>
        <TextInput style={styles.input} value={domain} onChangeText={setDomain} placeholder={t('customDomainPlaceholder')} autoCapitalize="none" placeholderTextColor="#999" />
        {customUrl && <TouchableOpacity onPress={() => Linking.openURL(customUrl)} style={[styles.linkRow, { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }]}><Ionicons name="globe-outline" size={16} color="#059669" /><Text style={[styles.linkText, { color: '#059669' }]}>{customUrl}</Text></TouchableOpacity>}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#2563eb' }]} onPress={saveWebsite} disabled={webSaving}>
          {webSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('saveChanges')}</Text>}
        </TouchableOpacity>

        <View style={[styles.guideBox, { marginTop: 16 }]}>
          <Text style={styles.guideTitle}>{t('redirectGuide')}</Text>
          <Text style={styles.guideStep}>1. {t('nsStep1') || 'Domain sağlayıcınızda NS değiştirin'}</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}><Text style={styles.tableCellHeader}>Tür</Text><Text style={styles.tableCellHeader}>Değer</Text></View>
            <View style={styles.tableRow}><Text style={styles.tableCell}>NS</Text><Text style={styles.tableCellSmall}>lily.ns.cloudflare.com</Text></View>
            <View style={styles.tableRow}><Text style={styles.tableCell}>NS</Text><Text style={styles.tableCellSmall}>ricardo.ns.cloudflare.com</Text></View>
          </View>
          <Text style={styles.guideHint}>{t('nsHint') || 'Eski NSleri silip bu ikisini ekleyin. Yayılma 5-30 dk.'}</Text>
          <Text style={[styles.guideStep, { marginTop: 8 }]}>2. {t('verifyStep')}</Text>
        </View>
      </View>

      <DomainManagerMobile />

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="color-palette-outline" size={20} color="#ec4899" /><Text style={styles.sectionTitle}>{t('design')}</Text></View>
        {theme ? (
          <View style={styles.themePreview}>
            <View style={[styles.colorSwatch, { backgroundColor: theme.primary_color || theme.primary || '#000' }]} />
            <View style={[styles.colorSwatch, { backgroundColor: theme.secondary_color || theme.secondary || '#fff', borderWidth: 1, borderColor: '#e5e7eb' }]} />
            <View style={[styles.colorSwatch, { backgroundColor: theme.accent_color || theme.accent || '#10b981' }]} />
            <Text style={styles.meta}>Seçili: {selectedTheme || theme.templateId || theme.template_id || 'özel'}</Text>
          </View>
        ) : <Text style={styles.meta}>{t('defaultTheme')}</Text>}
        <Text style={[styles.label, { marginTop: 12 }]}>{t('selectTheme')}</Text>
        <View style={styles.themeGrid}>
          {THEMES.map(th => (
            <TouchableOpacity key={th.id} style={[styles.themeCard, selectedTheme === th.id && styles.themeCardActive]} onPress={() => setSelectedTheme(th.id)}>
              <View style={[styles.themeColor, { backgroundColor: th.primary }]} />
              <Text style={[styles.themeName, selectedTheme === th.id && { color: '#6366f1' }]} numberOfLines={1}>{th.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#7c3aed' }]} onPress={saveTheme} disabled={themeSaving || !selectedTheme}>
          {themeSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('saveTheme')}</Text>}
        </TouchableOpacity>
        <Text style={styles.helper}>{t('themeSavedHint')}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="cart-outline" size={20} color="#f59e0b" /><Text style={styles.sectionTitle}>{t('marketplaceIntegrations')}</Text></View>
        <Text style={styles.helper}>{t('marketplaceIntegrationsDesc')}</Text>
        {allIntegrations.length === 0 ? <Text style={[styles.meta, { marginTop: 8 }]}>{t('noIntegrations')}</Text> : allIntegrations.map((ig: any) => {
          const mp = ig.marketplace
          const label = MP_LABELS[mp] || mp
          const isActive = !!ig.isActive
          const expanded = expandedMp === mp
          const det = mpDetails[mp]
          return (
            <View key={String(ig.id || mp)} style={[styles.mpCard, isActive ? styles.mpCardActive : styles.mpCardInactive]}>
              <TouchableOpacity style={styles.mpRow} onPress={() => handleMpExpand(mp)} activeOpacity={0.8}>
                <View style={[styles.mpIcon, isActive ? { backgroundColor: '#ecfdf5' } : { backgroundColor: '#fef2f2' }]}>
                  <Ionicons name={isActive ? 'checkmark-circle' : 'close-circle'} size={18} color={isActive ? '#10b981' : '#ef4444'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mpName}>{label}</Text>
                  <Text style={styles.mpMeta}>{mp} · {isActive ? t('active') : t('inactive')}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
              </TouchableOpacity>
              {expanded && (
                <View style={styles.mpDetail}>
                  {!det ? <ActivityIndicator size="small" color="#6366f1" /> : det.error ? <Text style={styles.mpError}>{det.error}</Text> : (
                    <>
                      {det.fields && Object.keys(det.fields).length > 0 ? Object.entries(det.fields).map(([key, label]: any) => (
                        <View key={key} style={{ marginBottom: 8 }}>
                          <Text style={styles.mpLabel}>{String(label)}</Text>
                          <TextInput
                            style={styles.mpInput}
                            value={det.config?.[key] || ''}
                            onChangeText={(v) => setMpDetails(prev => ({ ...prev, [mp]: { ...det, config: { ...det.config, [key]: v } } }))}
                            placeholder={key}
                            secureTextEntry={key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')}
                            placeholderTextColor="#999"
                          />
                        </View>
                      )) : <Text style={styles.meta}>{t('noFields')}</Text>}
                      {(mp === 'amazon' || mp === 'etsy') && (
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: mp === 'amazon' ? '#FF9900' : '#f56400' }]} onPress={() => handleOAuth(mp)}>
                          <Ionicons name="link-outline" size={14} color="#fff" />
                          <Text style={styles.saveBtnText}>{mp === 'amazon' ? t('amazonConnect') : t('etsyConnect')}</Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#111', flex: 1 }]} onPress={() => handleMpSave(mp)} disabled={mpSaving === mp}>
                          {mpSaving === mp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('saveIntegration')}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', flex: 1 }]} onPress={() => handleMpDelete(mp)}>
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={[styles.saveBtnText, { color: '#dc2626' }]}>{t('deleteIntegration')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )
        })}
        <Text style={[styles.meta, { marginTop: 8 }]}>{t('activeCount')}: {integrations.length} / {allIntegrations.length}</Text>
        <TouchableOpacity style={[styles.saveBtn, syncing && styles.disabled]} onPress={syncAllProducts} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('syncProducts')}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('changePasswordTitle')}</Text>
        <Text style={styles.meta}>{t('passwordHintGoogle')}</Text>
        <Text style={styles.label}>{t('currentPassword')}</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder={t('currentPassword')} secureTextEntry placeholderTextColor="#999" />
        <Text style={styles.label}>{t('newPassword')}</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder={t('passwordMinLength')} secureTextEntry placeholderTextColor="#999" />
        <Text style={styles.label}>{t('confirmNewPassword')}</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('confirmNewPassword')} secureTextEntry placeholderTextColor="#999" />
        <TouchableOpacity style={styles.saveBtn} onPress={changePassword} disabled={pwLoading}>
          {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('updatePassword')}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accountSection')}</Text>
        <Text style={styles.meta}>{t('email')}: {user?.email}</Text>
        <Text style={styles.meta}>{t('aiCredits')}: {user?.ai_credits}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>{t('signOut')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, color: '#374151', marginBottom: 6, marginTop: 8, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 10, backgroundColor: '#f9f9f9' },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  helper: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, backgroundColor: '#f0f9ff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  linkText: { fontSize: 11, color: '#2563eb', flex: 1, fontWeight: '600' },
  guideBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  guideTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2, gap: 4 },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#111' },
  guideContent: { marginTop: 8 },
  guideStep: { fontSize: 11, color: '#374151', marginBottom: 6 },
  table: { backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  tableRowHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 6, paddingHorizontal: 8 },
  tableCellHeader: { flex: 1, fontSize: 10, fontWeight: '700', color: '#6b7280' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  tableCell: { flex: 1, fontSize: 11, fontWeight: '600' },
  tableCellSmall: { flex: 1.5, fontSize: 10, color: '#2563eb' },
  guideHint: { fontSize: 10, color: '#6b7280', marginTop: 6 },
  themePreview: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  colorSwatch: { width: 28, height: 28, borderRadius: 6 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  themeCard: { width: 88, borderRadius: 8, borderWidth: 2, borderColor: '#e5e7eb', padding: 6, alignItems: 'center', backgroundColor: '#fff' },
  themeCardActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  themeColor: { width: 32, height: 32, borderRadius: 16, marginBottom: 4 },
  themeName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  mpCard: { borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1 },
  mpCardActive: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  mpCardInactive: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  mpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mpIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mpName: { fontSize: 13, fontWeight: '700' },
  mpMeta: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  mpDetail: { marginTop: 10, backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  mpLabel: { fontSize: 11, fontWeight: '600', color: '#374151', marginBottom: 4 },
  mpInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#f9f9f9', marginBottom: 6 },
  mpError: { fontSize: 12, color: '#dc2626' },
  saveBtn: { backgroundColor: '#000', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logoutBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  logoutBtnText: { color: '#666', fontSize: 14 },
  disabled: { opacity: 0.5 },
})

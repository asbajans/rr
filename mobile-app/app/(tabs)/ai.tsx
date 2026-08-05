import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Image, ScrollView, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useI18n } from '../../src/shared/i18n'
import { useAuth } from '../../src/shared/auth'
import { api } from '../../src/shared/api-client'
import type { AiChannel, AiChannelValidationResult, AiProductDraft, AiProductSession } from '../../src/shared/types'
import { Ionicons } from '@expo/vector-icons'

const CHANNELS: { key: AiChannel; icon: any }[] = [
  { key: 'storefront', icon: 'storefront-outline' },
  { key: 'trendyol', icon: 'cart-outline' },
  { key: 'hepsiburada', icon: 'cart-outline' },
  { key: 'pazarama', icon: 'cart-outline' },
  { key: 'n11', icon: 'cart-outline' },
  { key: 'amazon', icon: 'logo-amazon' },
  { key: 'etsy', icon: 'pricetag-outline' },
]

interface DraftForm {
  title: string
  description: string
  shortDescription: string
  category: string
  sku: string
  price: string
  stock: string
  keywords: string
}

type Step = 'photo' | 'review' | 'channels'

export default function AiScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const { can, refreshMe } = useAuth()
  const aiEnabled = can('ai_product_create')

  const [step, setStep] = useState<Step>('photo')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [session, setSession] = useState<AiProductSession | null>(null)
  const [draft, setDraft] = useState<AiProductDraft | null>(null)
  const [drafts, setDrafts] = useState<AiProductDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)

  const [draftForm, setDraftForm] = useState<DraftForm>({
    title: '', description: '', shortDescription: '', category: '', sku: '', price: '', stock: '10', keywords: '',
  })

  const [selectedChannels, setSelectedChannels] = useState<AiChannel[]>([])
  const [validation, setValidation] = useState<AiChannelValidationResult[]>([])
  const [validating, setValidating] = useState(false)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResults, setPublishResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDrafts = async () => {
    setDraftsLoading(true)
    try {
      setDrafts(await api.listAiProductDrafts())
    } catch {
      setDrafts([])
    } finally {
      setDraftsLoading(false)
    }
  }

  useEffect(() => {
    if (aiEnabled) loadDrafts()
  }, [aiEnabled])

  function setFormFromDraft(d: AiProductDraft) {
    setDraftForm({
      title: d.title || '',
      description: d.description || '',
      shortDescription: d.shortDescription || '',
      category: (d.categoryPath || []).join(' > '),
      sku: d.sku || '',
      price: d.suggestedPrice != null ? String(d.suggestedPrice) : '',
      stock: d.quantity != null ? String(d.quantity) : '10',
      keywords: (d.keywords || []).join(', '),
    })
  }

  function resetFlow() {
    setStep('photo')
    setImageUri(null)
    setSession(null)
    setDraft(null)
    setDraftForm({ title: '', description: '', shortDescription: '', category: '', sku: '', price: '', stock: '10', keywords: '' })
    setSelectedChannels([])
    setValidation([])
    setPublishResults([])
    setError('')
    setSuccess('')
    loadDrafts()
  }

  async function pickImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert(t('error'), t('galleryPermission'))
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
      setError('')
    }
  }

  async function takePhoto() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert(t('error'), t('cameraPermission'))
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setError('')
    }
  }

  async function pollForDraft(sessionId: string): Promise<AiProductDraft | null> {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500))
      const st = await api.getAiProductSessionStatus(sessionId)
      if (st.status === 'review' || st.status === 'approved' || st.status === 'completed') {
        const { draft } = await api.getAiProductSession(sessionId)
        return draft || null
      }
      if (st.status === 'failed') {
        throw new Error(st.errorMessage || t('aiSessionFailed'))
      }
    }
    const { draft } = await api.getAiProductSession(sessionId)
    return draft || null
  }

  async function handleAnalyze() {
    if (!imageUri) return
    setAnalyzing(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.createAiProductSessionFromImage(imageUri)
      setSession(res.session)

      let d = res.draft
      if (!d) {
        d = await pollForDraft(res.session.id)
      }
      if (!d) throw new Error(t('aiSessionFailed'))

      setDraft(d)
      setFormFromDraft(d)
      setStep('review')
      refreshMe()
      loadDrafts()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') {
        refreshMe()
        Alert.alert(t('error'), t('insufficientCredits'))
      } else if (err?.status === 402) {
        refreshMe()
        Alert.alert(t('error'), t('insufficientCredits'))
      } else {
        setError(err.message || t('aiSessionFailed'))
      }
    } finally {
      setAnalyzing(false)
    }
  }

  async function openDraft(id: number) {
    setError('')
    try {
      const d = await api.getAiProductDraft(id)
      setDraft(d)
      setFormFromDraft(d)
      setStep('review')
    } catch (err: any) {
      setError(err.message || t('aiLoadFailed'))
    }
  }

  async function deleteDraft(d: AiProductDraft) {
    Alert.alert(t('aiConfirmDelete'), '', [
      { text: t('prev'), style: 'cancel' },
      {
        text: t('edit'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAiProductDraft(d.id)
            if (draft?.id === d.id) resetFlow()
            else loadDrafts()
            setSuccess(t('aiDraftDeleted'))
          } catch (err: any) {
            setError(err.message || t('aiLoadFailed'))
          }
        },
      },
    ])
  }

  async function handleSaveDraft() {
    if (!draft) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api.updateAiProductDraft(draft.id, {
        title: draftForm.title,
        description: draftForm.description,
        shortDescription: draftForm.shortDescription,
        categoryPath: draftForm.category.split(' > ').map((s) => s.trim()).filter(Boolean),
        sku: draftForm.sku,
        suggestedPrice: draftForm.price ? parseFloat(draftForm.price) : undefined,
        quantity: draftForm.stock ? parseInt(draftForm.stock, 10) : undefined,
        keywords: draftForm.keywords.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setDraft(updated)
      setSuccess(t('aiDraftSaved'))
    } catch (err: any) {
      setError(err.message || t('aiLoadFailed'))
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(channel: AiChannel) {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
    setValidation([])
  }

  async function handleValidate() {
    if (!draft || selectedChannels.length === 0) return
    setValidating(true)
    setError('')
    try {
      setValidation(await api.validateAiProductChannels(draft.id, selectedChannels))
    } catch (err: any) {
      setError(err.message || t('aiLoadFailed'))
    } finally {
      setValidating(false)
    }
  }

  async function handleApprove() {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.approveAiProductDraft(draft.id)
      setDraft(updated)
      setSuccess(t('aiDraftApproved'))
    } catch (err: any) {
      setError(err.message || t('aiLoadFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!draft || selectedChannels.length === 0) {
      setError(t('aiSelectChannels'))
      return
    }
    setPublishing(true)
    setError('')
    setSuccess('')
    setPublishResults([])
    try {
      const res = await api.publishAiProductDraft(draft.id, selectedChannels)
      setPublishResults(res.results || [])
      setSuccess(t('aiPublishResult'))
      refreshMe()
      loadDrafts()
    } catch (err: any) {
      if (err?.code === 'PLAN_PRODUCT_LIMIT') {
        Alert.alert(t('error'), t('productLimitReached'))
      } else {
        setError(err.message || t('aiSessionFailed'))
      }
    } finally {
      setPublishing(false)
    }
  }

  function publishStatusLabel(status: string): { color: string; text: string } {
    if (status === 'published') return { color: '#16a34a', text: t('aiPublishPublished') }
    if (status === 'queued') return { color: '#2563eb', text: t('aiPublishQueued') }
    if (status === 'skipped') return { color: '#d97706', text: t('aiPublishSkipped') }
    return { color: '#dc2626', text: t('aiPublishFailed') }
  }

  function channelBadge(r: AiChannelValidationResult): { color: string; text: string } {
    if (r.status === 'ready') return { color: '#16a34a', text: t('aiChannelReady') }
    if (r.status === 'integration-not-connected') return { color: '#d97706', text: t('aiChannelIntegrationMissing') }
    if (r.status === 'category-mapping-needed') return { color: '#9333ea', text: t('aiChannelCategoryMapping') }
    return { color: '#dc2626', text: t('aiChannelMissingFields') }
  }

  if (!aiEnabled) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="sparkles-outline" size={28} color="#10b981" />
          <Text style={styles.headerTitle}>{t('aiStudio')}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{t('moduleDisabled')}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={() => router.push('/billing')}>
          <Ionicons name="arrow-up-circle-outline" size={22} color="#fff" />
          <Text style={styles.saveBtnText}>{t('upgradePlan')}</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  const StepPills = () => (
    <View style={styles.stepRow}>
      <View style={[styles.stepPill, step === 'photo' && styles.stepPillActive]}>
        <Text style={[styles.stepPillText, step === 'photo' && styles.stepPillTextActive]}>{t('aiPhotoStep')}</Text>
      </View>
      <View style={[styles.stepPill, step === 'review' && styles.stepPillActive]}>
        <Text style={[styles.stepPillText, step === 'review' && styles.stepPillTextActive]}>{t('aiReviewStep')}</Text>
      </View>
      <View style={[styles.stepPill, step === 'channels' && styles.stepPillActive]}>
        <Text style={[styles.stepPillText, step === 'channels' && styles.stepPillTextActive]}>{t('aiChannelsStep')}</Text>
      </View>
    </View>
  )

  const StatusBoxes = () => (
    <>
      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
      {success && <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View>}
    </>
  )

  // ---------------- STEP 1: PHOTO ----------------
  if (step === 'photo') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="sparkles-outline" size={28} color="#10b981" />
          <Text style={styles.headerTitle}>{t('aiStudio')}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{t('aiStudioSubtitle')}</Text>
        <StepPills />
        <StatusBoxes />

        {/* Saved drafts */}
        <Text style={styles.sectionLabel}>{t('aiDraftList')}</Text>
        {draftsLoading ? (
          <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 12 }} />
        ) : drafts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.draftsRow}>
            {drafts.map((d) => (
              <TouchableOpacity key={d.id} style={styles.draftCard} onPress={() => openDraft(d.id)}>
                {d.images && d.images[0] ? (
                  <Image source={{ uri: d.images[0] }} style={styles.draftCardImage} />
                ) : (
                  <View style={styles.draftCardImagePlaceholder}>
                    <Ionicons name="image-outline" size={22} color="#999" />
                  </View>
                )}
                <Text style={styles.draftCardTitle} numberOfLines={2}>{d.title || t('aiStudio')}</Text>
                <Text style={styles.draftCardMeta} numberOfLines={1}>
                  {t('aiSessionStatus')}: {d.status}
                </Text>
                <TouchableOpacity style={styles.draftDelete} onPress={() => deleteDraft(d)}>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyDrafts}>{t('aiNoDrafts')}</Text>
        )}

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
            <TouchableOpacity style={styles.sourceBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color="#fff" />
              <Text style={styles.sourceBtnText}>{t('chooseFromGallery')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageUri && !analyzing && (
          <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
            <Ionicons name="sparkles" size={22} color="#fff" />
            <Text style={styles.analyzeBtnText}>{t('analyzeProduct')}</Text>
          </TouchableOpacity>
        )}

        {analyzing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{t('aiSessionProcessing')}</Text>
          </View>
        )}
      </ScrollView>
    )
  }

  // ---------------- STEP 2: REVIEW / EDIT DRAFT ----------------
  if (step === 'review') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="create-outline" size={26} color="#3b82f6" />
          <Text style={styles.headerTitle}>{t('aiEditDraft')}</Text>
        </View>
        <StepPills />
        <StatusBoxes />

        {imageUri && <Image source={{ uri: imageUri }} style={styles.smallPreview} />}

        {draft && (
          <>
            {Object.keys(draft.confidence || {}).length > 0 && (
              <View style={styles.metaCard}>
                <Text style={styles.metaTitle}>{t('aiConfidence')}</Text>
                {Object.entries(draft.confidence).map(([k, v]) => (
                  <View key={k} style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{k}:</Text>
                    <Text style={styles.metaValue}>{Math.round(v * 100)}%</Text>
                  </View>
                ))}
              </View>
            )}

            {(draft as any).warnings && (draft as any).warnings.length > 0 ? (
              <View style={styles.metaCard}>
                <Text style={styles.metaTitle}>{t('aiWarnings')}</Text>
                {(draft as any).warnings.map((w: string, i: number) => (
                  <Text key={i} style={styles.metaValue}>• {w}</Text>
                ))}
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('title')}</Text>
                <TextInput
                  style={styles.input}
                  value={draftForm.title}
                  onChangeText={(v) => setDraftForm({ ...draftForm, title: v })}
                  placeholder={t('titlePlaceholder')}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('aiShortDescription')}</Text>
                <TextInput
                  style={styles.input}
                  value={draftForm.shortDescription}
                  onChangeText={(v) => setDraftForm({ ...draftForm, shortDescription: v })}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('description')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={draftForm.description}
                  onChangeText={(v) => setDraftForm({ ...draftForm, description: v })}
                  placeholder={t('descPlaceholder')}
                  multiline
                  numberOfLines={5}
                />
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('code')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draftForm.sku}
                    onChangeText={(v) => setDraftForm({ ...draftForm, sku: v })}
                    placeholder={t('codePlaceholder')}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('category')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draftForm.category}
                    onChangeText={(v) => setDraftForm({ ...draftForm, category: v })}
                  />
                </View>
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('aiSuggestedPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draftForm.price}
                    onChangeText={(v) => setDraftForm({ ...draftForm, price: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('stock')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draftForm.stock}
                    onChangeText={(v) => setDraftForm({ ...draftForm, stock: v })}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('aiKeywords')}</Text>
                <TextInput
                  style={styles.input}
                  value={draftForm.keywords}
                  onChangeText={(v) => setDraftForm({ ...draftForm, keywords: v })}
                />
              </View>

              {draft.tags && draft.tags.length > 0 && (
                <View style={styles.chipsWrap}>
                  <Text style={styles.chipsLabel}>{t('aiTags')}:</Text>
                  <View style={styles.chipsRow}>
                    {draft.tags.map((tag, i) => (
                      <View key={i} style={styles.chip}><Text style={styles.chipText}>{tag}</Text></View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.formButtons}>
                <TouchableOpacity style={[styles.formBtn, styles.formBtnSecondary]} onPress={() => { setStep('photo'); setError(''); setSuccess('') }}>
                  <Ionicons name="arrow-back" size={18} color="#333" />
                  <Text style={styles.formBtnSecondaryText}>{t('prev')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary]} onPress={handleSaveDraft} disabled={saving}>
                  {saving ? <ActivityIndicator size={18} color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                  <Text style={styles.formBtnPrimaryText}>{t('aiSaveDraft')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary, { backgroundColor: '#10b981' }]} onPress={() => setStep('channels')}>
                  <Text style={styles.formBtnPrimaryText}>{t('next')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    )
  }

  // ---------------- STEP 3: CHANNELS ----------------
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="paper-plane-outline" size={26} color="#8b5cf6" />
        <Text style={styles.headerTitle}>{t('aiChannelsStep')}</Text>
      </View>
      <Text style={styles.headerSubtitle}>{t('aiSelectChannels')}</Text>
      <StepPills />
      <StatusBoxes />

      {CHANNELS.map((c) => {
        const active = selectedChannels.includes(c.key)
        const badge = validation.find((v) => v.channel === c.key)
        return (
          <TouchableOpacity
            key={c.key}
            style={[styles.channelRow, active && styles.channelRowActive]}
            onPress={() => toggleChannel(c.key)}
          >
            <Ionicons name={c.icon} size={20} color={active ? '#7c3aed' : '#666'} />
            <Text style={[styles.channelName, active && styles.channelNameActive]}>{c.key}</Text>
            {active && <Ionicons name="checkmark-circle" size={20} color="#7c3aed" />}
            {badge && (
              <View style={[styles.channelBadge, { backgroundColor: channelBadge(badge).color }]}>
                <Text style={styles.channelBadgeText}>{channelBadge(badge).text}</Text>
              </View>
            )}
          </TouchableOpacity>
        )
      })}

      {validation.length > 0 && (
        <View style={styles.metaCard}>
          {validation.map((r) => {
            const badge = channelBadge(r)
            return (
              <View key={r.channel} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{r.channel}:</Text>
                <Text style={[styles.metaValue, { color: badge.color, fontWeight: '600' }]}>
                  {badge.text}
                  {r.status === 'missing-fields' && r.missingFields.length > 0
                    ? ` (${r.missingFields.join(', ')})`
                    : ''}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {draft && draft.status === 'approved' && (
        <View style={styles.successBox}><Text style={styles.successText}>{t('aiDraftApproved')}</Text></View>
      )}

      {publishResults.length > 0 && (
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>{t('aiPublishResult')}</Text>
          {publishResults.map((r) => {
            const badge = publishStatusLabel(r.status || 'failed')
            return (
              <View key={r.channel} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{r.channel}:</Text>
                <Text style={[styles.metaValue, { color: badge.color, fontWeight: '600' }]}>
                  {badge.text}
                  {r.error ? ` — ${r.error}` : r.externalId ? ` (${r.externalId})` : ''}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      <View style={styles.channelActions}>
        <TouchableOpacity
          style={[styles.formBtn, styles.formBtnSecondary]}
          onPress={() => { setStep('review'); setError(''); setSuccess('') }}
        >
          <Ionicons name="arrow-back" size={18} color="#333" />
          <Text style={styles.formBtnSecondaryText}>{t('aiBackToDraft')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formBtn, styles.formBtnPrimary, { backgroundColor: '#7c3aed' }]}
          onPress={handleValidate}
          disabled={validating || selectedChannels.length === 0}
        >
          {validating ? <ActivityIndicator size={18} color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />}
          <Text style={styles.formBtnPrimaryText}>{t('aiValidateChannels')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.publishActions}>
        <TouchableOpacity style={[styles.publishBtn, { backgroundColor: '#2563eb' }]} onPress={handleApprove} disabled={saving}>
          {saving ? <ActivityIndicator size={20} color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={styles.publishBtnText}>{t('aiApproveDraft')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: '#000' }]}
          onPress={handlePublish}
          disabled={publishing || selectedChannels.length === 0}
        >
          {publishing ? <ActivityIndicator size={20} color="#fff" /> : <Ionicons name="paper-plane-outline" size={20} color="#fff" />}
          <Text style={styles.publishBtnText}>{t('aiPublish')}</Text>
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
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8, marginTop: 4 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stepPill: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e5e5e5', alignItems: 'center' },
  stepPillActive: { backgroundColor: '#10b981' },
  stepPillText: { fontSize: 12, fontWeight: '600', color: '#666' },
  stepPillTextActive: { color: '#fff' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14 },
  successBox: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 12, marginBottom: 16 },
  successText: { color: '#16a34a', fontSize: 14 },
  draftsRow: { flexDirection: 'row', marginBottom: 16 },
  draftCard: { width: 140, marginRight: 10, backgroundColor: '#fff', borderRadius: 10, padding: 8 },
  draftCardImage: { width: '100%', height: 80, borderRadius: 8, marginBottom: 6 },
  draftCardImagePlaceholder: { width: '100%', height: 80, borderRadius: 8, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  draftCardTitle: { fontSize: 12, fontWeight: '600', color: '#333' },
  draftCardMeta: { fontSize: 10, color: '#999', marginTop: 2 },
  draftDelete: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3 },
  emptyDrafts: { fontSize: 13, color: '#999', marginBottom: 16 },
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
  smallPreview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
  metaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  metaTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 },
  metaLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  metaValue: { fontSize: 12, color: '#333', flexShrink: 1 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  field: { marginBottom: 16, flex: 1 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  chipsWrap: { marginBottom: 16 },
  chipsLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, color: '#555' },
  formButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  formBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  formBtnPrimary: { backgroundColor: '#2563eb' },
  formBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  formBtnSecondary: { backgroundColor: '#f0f0f0' },
  formBtnSecondaryText: { color: '#333', fontWeight: '600', fontSize: 14 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  channelRowActive: { borderWidth: 1, borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  channelName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  channelNameActive: { color: '#7c3aed' },
  channelBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  channelBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  channelActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  publishActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  publishBtn: { flex: 1, borderRadius: 12, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  saveBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})

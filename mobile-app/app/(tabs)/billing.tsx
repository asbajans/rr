import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../../src/shared/auth'
import { useI18n } from '../../src/shared/i18n'
import { api } from '../../src/shared/api-client'
import type { Plan, Subscription } from '../../src/shared/types'

const CREDIT_PACKAGES = [
  { credits: 50, price: 50 },
  { credits: 200, price: 150 },
  { credits: 500, price: 300 },
]

export default function BillingScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const [plansRes, subRes] = await Promise.all([
        api.getPlans(),
        api.getSubscription(),
      ])
      setPlans(plansRes)
      setSubscription(subRes.subscription)
      setCurrentPlan(subRes.plan)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function openStripe(url: string, key: string) {
    if (!url) return
    setBusy(key)
    try {
      await WebBrowser.openBrowserAsync(url)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handlePlan(plan: Plan) {
    if (plan.id === currentPlan?.id) return
    if (plan.price <= 0) {
      setBusy('plan-' + plan.id)
      try {
        await api.createCheckoutSession(plan.id)
        load()
      } catch (e: any) {
        Alert.alert(t('error'), e.message)
      } finally {
        setBusy(null)
      }
      return
    }
    setBusy('plan-' + plan.id)
    try {
      const r = await api.createCheckoutSession(plan.id)
      await openStripe(r.url, 'plan-' + plan.id)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleCredit(credits: number) {
    setBusy('credit-' + credits)
    try {
      const r = await api.purchaseCredits(credits)
      await openStripe(r.url, 'credit-' + credits)
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleManage() {
    setBusy('manage')
    try {
      const r = await api.createPortalSession()
      await openStripe(r.url, 'manage')
    } catch (e: any) {
      Alert.alert(t('error'), e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleCancel() {
    Alert.alert(t('cancelPlan'), t('sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy('cancel')
          try {
            await api.cancelSubscription()
            load()
          } catch (e: any) {
            Alert.alert(t('error'), e.message)
          } finally {
            setBusy(null)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>&lt; {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('billing')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('currentPlan')}</Text>
        <Text style={styles.planName}>{currentPlan ? currentPlan.name : t('planFree')}</Text>
        {currentPlan && currentPlan.price > 0 && (
          <Text style={styles.planMeta}>
            {currentPlan.price} {currentPlan.currency} {t('perMonth')}
          </Text>
        )}
        <View style={styles.creditBox}>
          <Text style={styles.creditLabel}>{t('remainingCredits')}</Text>
          <Text style={styles.creditValue}>{user?.ai_credits ?? 0}</Text>
        </View>
        {subscription && subscription.stripe_id && (
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.outlineBtn]} onPress={handleManage} disabled={!!busy}>
              {busy === 'manage' ? <ActivityIndicator color="#000" /> : <Text style={styles.outlineBtnText}>{t('manageSubscription')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.delBtn]} onPress={handleCancel} disabled={!!busy}>
              {busy === 'cancel' ? <ActivityIndicator color="#fff" /> : <Text style={styles.delBtnText}>{t('cancelPlan')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('choosePlan')}</Text>
      {plans.map((p) => {
        const active = p.id === currentPlan?.id
        return (
          <View key={p.id} style={[styles.planCard, active && styles.planCardActive]}>
            <View style={styles.planCardHead}>
              <Text style={styles.planCardName}>{p.name}</Text>
              <Text style={styles.planCardPrice}>
                {p.price > 0 ? `${p.price} ${p.currency}${t('perMonth')}` : t('planFree')}
              </Text>
            </View>
            {p.description && <Text style={styles.planDesc}>{p.description}</Text>}
            <View style={styles.planFeat}>
              <Text style={styles.planFeatText}>{t('planIncludes')}: {p.ai_credits} {t('aiCredits')}</Text>
              <Text style={styles.planFeatText}>{t('productsLimit')}: {p.product_limit < 0 ? '∞' : p.product_limit}</Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, active ? styles.disabledBtn : styles.primaryBtn]}
              onPress={() => handlePlan(p)}
              disabled={active || !!busy}
            >
              {busy === 'plan-' + p.id ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.btnText}>{active ? t('currentPlan') : t('buyPlan')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )
      })}

      <Text style={styles.sectionTitle}>{t('creditPackages')}</Text>
      {CREDIT_PACKAGES.map((c) => (
        <View key={c.credits} style={styles.creditCard}>
          <View style={styles.creditCardInfo}>
            <Text style={styles.creditCardTitle}>{t('credits' + c.credits)}</Text>
            <Text style={styles.creditCardPrice}>₺{c.price}</Text>
          </View>
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, styles.creditBuyBtn]}
            onPress={() => handleCredit(c.credits)}
            disabled={!!busy}
          >
            {busy === 'credit-' + c.credits ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('buyCredits')}</Text>}
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 16, color: '#000', fontWeight: '600' },
  headerSpacer: { width: 50 },
  title: { fontSize: 20, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 8 },
  cardTitle: { fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  planName: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  planMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  creditBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9f4', borderRadius: 10, padding: 14, marginTop: 14 },
  creditLabel: { fontSize: 14, color: '#059669', fontWeight: '600' },
  creditValue: { fontSize: 22, fontWeight: '700', color: '#059669' },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginHorizontal: 20, marginTop: 24, marginBottom: 8 },
  planCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12 },
  planCardActive: { borderWidth: 2, borderColor: '#059669' },
  planCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCardName: { fontSize: 18, fontWeight: '700' },
  planCardPrice: { fontSize: 14, fontWeight: '600', color: '#333' },
  planDesc: { fontSize: 13, color: '#666', marginTop: 6 },
  planFeat: { marginTop: 10 },
  planFeatText: { fontSize: 13, color: '#444', marginTop: 2 },
  creditCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditCardInfo: { flex: 1 },
  creditCardTitle: { fontSize: 16, fontWeight: '600' },
  creditCardPrice: { fontSize: 14, color: '#666', marginTop: 2 },
  creditBuyBtn: { flex: 0, paddingHorizontal: 20, marginTop: 0 },
  btn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 14, flex: 1 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  primaryBtn: { backgroundColor: '#000' },
  outlineBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000' },
  outlineBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
  delBtn: { backgroundColor: '#fce4ec', flex: 1 },
  delBtnText: { color: '#c62828', fontSize: 16, fontWeight: '600' },
  disabledBtn: { backgroundColor: '#059669' },
})

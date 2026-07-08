import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native'
import { api } from '../../src/shared/api-client'
import type { Plan } from '../../src/shared/types'

export default function SuperPlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const data = await api.getAdminPlans()
      setPlans(data)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function formatPrice(price: number, currency: string) {
    return `${price} ${currency}`
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
            <Text style={styles.detail}>{item.product_limit} products</Text>
            <Text style={styles.detail}>{item.ai_credits} AI credits</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '700', marginTop: 4, color: '#000' },
  detail: { fontSize: 14, color: '#666', marginTop: 4 },
})

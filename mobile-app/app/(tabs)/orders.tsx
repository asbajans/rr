import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native'
import { api } from '../../src/shared/api-client'
import type { Order } from '../../src/shared/types'

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminOrders()
      setOrders(res.data)
      setTotal(res.total)
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.count}>{total} Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.orderId}>#{item.id?.slice(0, 8)}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  count: { fontSize: 14, color: '#666' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: '600' },
})

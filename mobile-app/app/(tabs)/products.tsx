import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { api } from '../../src/shared/api-client'
import type { Product } from '../../src/shared/types'

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminProducts()
      setProducts(res.data)
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
        <Text style={styles.count}>{total} Products</Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.productName}>{item.label}</Text>
              <Text style={styles.productCode}>{item.code}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.price}>{item.price ? `$${item.price}` : '-'}</Text>
              <Text style={[styles.status, item.status === 1 ? styles.active : styles.inactive]}>
                {item.status === 1 ? 'Active' : 'Inactive'}
              </Text>
            </View>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600' },
  productCode: { fontSize: 13, color: '#999', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  active: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  inactive: { backgroundColor: '#fce4ec', color: '#c62828' },
})

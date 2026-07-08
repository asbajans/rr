import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native'
import { api } from '../../src/shared/api-client'
import type { Store } from '../../src/shared/types'

export default function SuperStoresScreen() {
  const [stores, setStores] = useState<Store[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminStores()
      setStores(res.data)
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
      <FlatList
        data={stores}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.code}>{item.site_code}</Text>
            {item.domain && <Text style={styles.domain}>{item.domain}</Text>}
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
  name: { fontSize: 16, fontWeight: '600' },
  code: { fontSize: 13, color: '#999', marginTop: 2 },
  domain: { fontSize: 13, color: '#666', marginTop: 2 },
})

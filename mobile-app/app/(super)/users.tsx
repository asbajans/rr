import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native'
import { api } from '../../src/shared/api-client'
import type { User } from '../../src/shared/types'

export default function SuperUsersScreen() {
  const [users, setUsers] = useState<User[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await api.getAdminUsers()
      setUsers(res.data)
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
        data={users}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.badge}>{item.is_admin ? 'Admin' : 'User'}</Text>
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
  email: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: {
    fontSize: 12, color: '#fff', backgroundColor: '#000',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    alignSelf: 'flex-start', marginTop: 8, overflow: 'hidden',
  },
})

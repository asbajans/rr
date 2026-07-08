import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/shared/auth'
import { Ionicons } from '@expo/vector-icons'

export default function SuperLayout() {
  const { user } = useAuth()

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  if (!user.is_admin) {
    return <Redirect href="/(tabs)/" />
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#000',
      tabBarInactiveTintColor: '#999',
      headerStyle: { backgroundColor: '#1a1a2e' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: '600' },
      tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a3e' },
      tabBarActiveTintColor: '#fff',
      tabBarInactiveTintColor: '#666',
    }}>
      <Tabs.Screen
        name="stores"
        options={{
          title: 'Stores',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

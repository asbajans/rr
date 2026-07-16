import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/shared/auth'
import { useI18n } from '../../src/shared/i18n'
import { Ionicons } from '@expo/vector-icons'

export default function SuperLayout() {
  const { user } = useAuth()
  const { t } = useI18n()

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  if (!user.is_admin) {
    return <Redirect href="/(tabs)/" />
  }

  return (
    <Tabs screenOptions={{
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
          title: t('stores'),
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t('users'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: t('plans'),
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

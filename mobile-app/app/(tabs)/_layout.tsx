import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/shared/auth'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '../../src/shared/i18n'

export default function TabLayout() {
  const { user } = useAuth()
  const { t } = useI18n()

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#000',
      tabBarInactiveTintColor: '#999',
      headerStyle: { backgroundColor: '#fff' },
      headerTitleStyle: { fontWeight: '600' },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: t('products'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('orders'),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: t('billing'),
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="products/[id]" options={{ href: null, title: 'Ürün Detayı' }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null, title: 'Sipariş Detayı' }} />
    </Tabs>
  )
}

import { Tabs, Redirect } from 'expo-router'
import { Pressable, View, Text } from 'react-native'
import { useAuth } from '../../src/shared/auth'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '../../src/shared/i18n'

function AiFabButton({ children, onPress, accessibilityState }: any) {
  const focused = accessibilityState?.selected
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: focused ? '#059669' : '#10b981',
        alignItems: 'center', justifyContent: 'center',
        marginTop: -16,
        shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        borderWidth: 3, borderColor: '#fff',
      }}>
        <Ionicons name="add" size={28} color="#fff" />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '700', color: focused ? '#059669' : '#10b981', marginTop: 2 }}>ÜRÜN EKLE</Text>
    </Pressable>
  )
}

export default function TabLayout() {
  const { user, can } = useAuth()
  const { t } = useI18n()
  const b2bEnabled = can('b2b_request') || can('b2b') || can('b2b_supply')
  const supplierEnabled = can('b2b_supply') || can('b2b')

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#000',
      tabBarInactiveTintColor: '#999',
      headerStyle: { backgroundColor: '#fff' },
      headerTitleStyle: { fontWeight: '600' },
      tabBarStyle: { height: 66, paddingBottom: 6, paddingTop: 4, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 2 },
      tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginTop: 2 },
      tabBarItemStyle: { flex: 1, paddingHorizontal: 1, minWidth: 0 },
      tabBarIconStyle: { marginBottom: 1 },
      tabBarHideOnKeyboard: true,
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
        name="ai"
        options={{
          title: 'Ürün Ekle',
          tabBarLabel: '',
          tabBarButton: (props: any) => <AiFabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="marketing"
        options={{
          title: t('marketing'),
          tabBarLabel: t('marketing'),
          tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="b2b/index"
        options={{
          href: b2bEnabled ? undefined : null,
          title: t('b2bDiscover'),
          tabBarLabel: t('b2bDiscoverTab'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="b2b/requests"
        options={{
          href: null,
          title: t('b2bRequests'),
          tabBarLabel: t('b2bRequests'),
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="supplier"
        options={{
          href: supplierEnabled ? undefined : null,
          title: t('supplier'),
          tabBarLabel: t('supplier'),
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
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
      <Tabs.Screen name="products/[id]" options={{ href: null, title: t('productDetail') }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null, title: t('orderDetail') }} />
    </Tabs>
  )
}

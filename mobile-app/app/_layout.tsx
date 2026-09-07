import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { AuthProvider, useAuth } from '../src/shared/auth'
import { I18nProvider } from '../src/shared/i18n'
import { ActivityIndicator, View } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

function RootLayout() {
  const { loading } = useAuth()

  useEffect(() => {
    // Foreground: system already shows banner with sound via handler.
    // Also trigger haptic via vibration pattern on orders channel.
    const sub = Notifications.addNotificationReceivedListener((event) => {
      const type = (event.request.content.data as any)?.type
      if (String(type).includes('order')) {
        // Android channel 'orders' already plays coin.wav; iOS uses coin.wav via APNS
      }
    })
    const subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any
      if (data?.orderId) {
        // deep-link handled by tabs; no-op here
      }
    })
    return () => {
      sub.remove()
      subResponse.remove()
    }
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(super)" />
      </Stack>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <RootLayout />
      </I18nProvider>
    </AuthProvider>
  )
}

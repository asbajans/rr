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
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function RootLayout() {
  const { loading } = useAuth()

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {})
    return () => sub.remove()
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

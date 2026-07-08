import { Stack, Redirect } from 'expo-router'
import { useAuth } from '../../src/shared/auth'

export default function AuthLayout() {
  const { user } = useAuth()

  if (user) {
    return <Redirect href={user.is_admin ? '/(super)/stores' : '/(tabs)/'} />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}

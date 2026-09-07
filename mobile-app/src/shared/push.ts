import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export async function getFcmToken(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status } = await Notifications.getPermissionsAsync()
  let finalStatus = status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    finalStatus = req.status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bildirimler',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    })
    // High-priority channel for orders — coin sound (bozuk para sesi)
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Siparişler',
      description: 'Yeni sipariş geldiğinde bozuk para sesiyle bildirim',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'coin.wav',
      enableVibrate: true,
      showBadge: true,
    })
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync()
    return typeof token.data === 'string' ? token.data : null
  } catch {
    return null
  }
}

import { Image, StyleSheet } from 'react-native'

export function Logo({ width = 120, height = 32 }: { width?: number; height?: number }) {
  return <Image source={require('../../../assets/logo.jpeg')} style={[styles.logo, { width, height }]} resizeMode="contain" />
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 32 },
})

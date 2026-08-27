import type { Metadata } from 'next'
import DeleteAccountClient from './client'

export const metadata: Metadata = {
  title: 'Hesabımı Sil — Rahatio',
  description: 'Rahatio hesabınızı ve kişisel verilerinizi silme talebi. 3 adımlı onay ile hesabınızı pasife alın. KVKK m.11 / GDPR.',
}

export default function Page() {
  return <DeleteAccountClient />
}

export const SCENARIO_CODES = [
  { code: 'analyze_product', name: 'Ürün Analizi', desc: 'Görselden kategori/özellik çıkarma' },
  { code: 'generate_description', name: 'Açıklama Üretimi', desc: 'Başlık+özelliklerden SEO açıklama' },
  { code: 'process_image', name: 'Resim İşleme', desc: 'Arka plan temizleme / resim üretim' },
  { code: 'agentic_listing', name: 'Agentik İlan Akışı', desc: 'Fotoğraf → ilan hazırlama → yayınlama' },
  { code: 'chat', name: 'Sohbet/Chat', desc: 'Müşteri destek asistanı' },
  { code: 'search', name: 'Semantik Arama', desc: 'Ürünler arası anlam bazlı arama' },
  { code: 'recommend', name: 'Öneri Sistemi', desc: 'Cross-sell / Up-sell önerileri' },
] as const

export const AI_HUB_TABS = [
  { key: 'providers', label: 'Sağlayıcılar & Modeller' },
  { key: 'scenarios', label: 'Senaryolar' },
  { key: 'rate-limits', label: 'Rate Limits' },
  { key: 'settings', label: 'Global Ayarlar' },
  { key: 'test', label: 'Provider Test' },
] as const

export type AiHubTabKey = (typeof AI_HUB_TABS)[number]['key']

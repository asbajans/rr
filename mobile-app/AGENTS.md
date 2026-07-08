# Rahatio Mobile App — AGENTS.md

## Genel Bilgi

React Native (Expo SDK 52) mobil uygulaması. Store owner'lar için panel, AI görsel işleme takibi.

## Kurallar

- Expo Router (file-based routing) kullan
- `app/` dizininde sayfalar, `src/shared/`'de shared kod
- Tüm API çağrıları `src/shared/api-client.ts` üzerinden
- Auth state: `src/shared/auth.tsx` (AuthContext + Provider)
- Tip tanımları: `src/shared/types.ts`
- Stil: React Native `StyleSheet.create()`, Tailwind/flexbox pattern
- Renk paleti: siyah/beyaz (#000, #fff, #666, #999)
- Tab navigation: `@react-navigation/bottom-tabs` + `@expo/vector-icons` (Ionicons)

## Route Yapısı

```
app/
├── _layout.tsx              # Root layout (AuthProvider)
├── (auth)/
│   ├── _layout.tsx          # Auth guard (redirect if logged in)
│   ├── login.tsx            # Giriş
│   └── register.tsx         # Kayıt
├── (tabs)/                  # Store owner (bottom tabs)
│   ├── _layout.tsx          # Tab layout (auth guard)
│   ├── index.tsx            # Dashboard
│   ├── products.tsx         # Ürünler
│   ├── orders.tsx           # Siparişler
│   ├── ai.tsx               # AI Görsel
│   └── settings.tsx         # Ayarlar
└── (super)/                 # Super admin (dark theme tabs)
    ├── _layout.tsx          # Tab layout (auth guard + is_admin check)
    ├── stores.tsx           # Mağazalar
    ├── users.tsx            # Kullanıcılar
    └── plans.tsx            # Planlar
```

## Shared Paket (`src/shared/`)

| Dosya | Açıklama |
|-------|----------|
| `types.ts` | TypeScript tipleri (frontend/lib/types.ts ile senkronize) |
| `api-client.ts` | API client (AsyncStorage/SecureStore, fetch, Expo FileSystem) |
| `auth.tsx` | Auth context + provider + useAuth hook |
| `utils.ts` | Yardımcı fonksiyonlar (cn, formatPrice, formatDate) |

## Önemli Farklar (Frontend vs Mobile)

| Özellik | Frontend | Mobile |
|---------|----------|--------|
| Storage | localStorage | SecureStore (fallback AsyncStorage) |
| File Download | window.open | expo-file-system + expo-sharing |
| Image Picker | `<input type="file">` | expo-image-picker |
| Still | Tailwind CSS | StyleSheet.create() |
| Routing | Next.js App Router | Expo Router |

## Bağımlılıklar

- `expo`, `expo-router`, `expo-status-bar`
- `expo-secure-store`, `expo-file-system`, `expo-sharing`
- `expo-image-picker`, `expo-web-browser`
- `@react-navigation/bottom-tabs`, `@expo/vector-icons`
- `react-native-safe-area-context`, `react-native-screens`
- `@react-native-async-storage/async-storage`

## Geliştirme

```bash
cd mobile-app
npm install
npx expo start        # Geliştirme sunucusu
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
```

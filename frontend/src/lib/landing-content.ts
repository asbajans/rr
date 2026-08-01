export type Lang = 'en' | 'tr' | 'es'

export type LandingContent = {
  nav: { how: string; marketplaces: string; solutions: string; pricing: string }
  cta: {
    signIn: string
    startFree: string
    startTrial: string
    watch: string
    demo: string
    talkSales: string
    panel: string
  }
  hero: { badge: string; title1: string; title2: string; body: string }
  stats: { value: string; label: string }[]
  how: { heading: string; body: string; steps: { title: string; body: string }[] }
  features: {
    heading: string
    items: { title: string; body: string; icon: string }[]
  }
  markets: { heading: string; body: string; names: string[] }
  solutions: {
    tag: string
    title: string
    body: string
    points: string[]
    icon: string
  }[]
  pricing: {
    heading: string
    body: string
    popular: string
    perMonth: string
    plans: {
      name: string
      price: string
      body: string
      points: string[]
      cta: string
    }[]
  }
  final: { title1: string; title2: string; body: string }
  footer: string
  scan: {
    steps: { label: string; caption: string }[]
    chips: string[]
    live: string
    prompts: string[]
  }
  marquee: string[][]
}

const en: LandingContent = {
  nav: { how: 'How it works', marketplaces: 'Marketplaces', solutions: 'Solutions', pricing: 'Pricing' },
  cta: {
    signIn: 'Sign in',
    startFree: 'Start free',
    startTrial: 'Start free trial',
    watch: 'Watch the AI in action',
    demo: 'Book a demo',
    talkSales: 'Talk to sales',
    panel: 'Go to panel',
  },
  hero: {
    badge: 'AI product management, end to end',
    title1: 'Photograph a product.',
    title2: 'Sell it everywhere.',
    body: 'Rahatio turns a single phone photo into a complete, compliant, multilingual listing — then publishes it across every marketplace, your own store, your B2B portal and your dropshipping network.',
  },
  stats: [
    { value: '12s', label: 'photo → live listing' },
    { value: '40+', label: 'marketplace integrations' },
    { value: '14', label: 'languages generated' },
    { value: '98.4%', label: 'attribute accuracy' },
  ],
  how: {
    heading: 'From shelf to storefront in four automated moves',
    body: 'No product feeds, no CSV mapping, no copywriter. The AI pipeline does the boring 90%.',
    steps: [
      { title: 'Snap', body: 'Take a photo in the Rahatio mobile app — no studio, no spreadsheets.' },
      { title: 'Analyze', body: 'Vision AI identifies the product and enriches it with 60+ structured attributes.' },
      { title: 'Generate', body: 'Channel-ready titles, descriptions, keywords and prices in 14 languages.' },
      { title: 'Publish', body: 'One tap sends the listing live everywhere and keeps stock in sync.' },
    ],
  },
  features: {
    heading: 'One platform instead of nine tools',
    items: [
      { icon: 'bot', title: 'AI Product Management', body: 'One photo becomes a complete product record: attributes, category, condition, pricing and multilingual copy.' },
      { icon: 'earth', title: 'Marketplace Integrations', body: 'Publish and sync to every major marketplace with channel-specific rules, taxonomies and image formats.' },
      { icon: 'shopping-bag', title: 'Instant E-Commerce', body: 'Spin up your own branded storefront from the same catalog — checkout, payments and shipping included.' },
      { icon: 'handshake', title: 'B2B Wholesale', body: 'Tiered price lists, quote requests, net terms and a private catalog for your retail partners.' },
      { icon: 'truck', title: 'Legal Dropshipping', body: 'Vetted suppliers, contract templates, VAT handling and compliance checks per destination market.' },
      { icon: 'chart-line', title: 'Repricing & Insights', body: 'Live margin tracking, competitor repricing and demand forecasting across all your channels.' },
    ],
  },
  markets: {
    heading: 'Integrated with every channel you sell on',
    body: "Native connectors handle each marketplace's taxonomy, media rules and order lifecycle.",
    names: ['Amazon', 'eBay', 'Etsy', 'Shopify', 'Walmart', 'Trendyol', 'N11', 'Pazarama', 'Allegro', 'Zalando', 'Otto', 'Cdiscount', 'Bol.com', 'TikTok Shop'],
  },
  solutions: [
    {
      icon: 'boxes',
      tag: 'Catalog',
      title: 'Own your product data',
      body: 'A single source of truth with versioning, bulk edits and AI quality scoring on every SKU.',
      points: ['60+ auto attributes', 'Duplicate detection', 'Image cleanup & upscaling'],
    },
    {
      icon: 'package-check',
      tag: 'Fulfilment',
      title: 'Ship from anywhere',
      body: 'Connect your warehouse, 3PL or dropshipping suppliers and route each order automatically.',
      points: ['Supplier routing', 'Live stock sync', 'Tracking write-back'],
    },
    {
      icon: 'shield-check',
      tag: 'Compliance',
      title: 'Sell without legal guesswork',
      body: 'Built-in EU/US compliance: VAT, GPSR, returns policies and supplier contracts per market.',
      points: ['VAT & invoicing', 'GPSR checks', 'Contract templates'],
    },
  ],
  pricing: {
    heading: 'Simple, scalable pricing',
    body: '14-day free trial. No card required. Cancel anytime.',
    popular: 'Most popular',
    perMonth: '/mo',
    plans: [
      {
        name: 'Starter',
        price: '€39',
        body: 'For solo sellers testing AI listing at small scale.',
        points: ['500 AI listings / mo', '3 marketplace channels', '1 storefront', 'Email support'],
        cta: 'startFree',
      },
      {
        name: 'Growth',
        price: '€149',
        body: 'For growing brands selling across many channels.',
        points: ['10,000 AI listings / mo', 'Unlimited channels', 'B2B wholesale portal', 'Repricing engine', 'Priority support'],
        cta: 'startFree',
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        body: 'For distributors and dropshipping networks.',
        points: ['Unlimited everything', 'Dedicated supplier onboarding', 'SLA & SSO', 'Custom AI models'],
        cta: 'talkSales',
      },
    ],
  },
  final: {
    title1: 'Your next product listing is',
    title2: 'one photo away',
    body: 'Join sellers using Rahatio to launch faster across marketplaces, storefronts, B2B and dropshipping — without adding headcount.',
  },
  footer: 'Rahatio. AI product management for modern commerce.',
  scan: {
    steps: [
      { label: 'Photo captured', caption: 'Snap the product with your phone' },
      { label: 'AI vision analyzing', caption: 'Detecting category, brand, condition and attributes' },
      { label: 'Listing generated', caption: 'Title, description, keywords and price in 14 languages' },
      { label: 'Published everywhere', caption: 'Live on all connected marketplaces' },
    ],
    chips: ['Jacket × 98%', 'Brand detected', 'New with tags'],
    live: 'Live on 12 marketplaces',
    prompts: [
      'Identifying object silhouette…',
      'Matching against 240M product catalog…',
      'Reading label: cotton blend, 320 gsm',
      'Estimating condition: new with tags',
      'Generating SEO title for Amazon…',
      'Writing bullet points for eBay…',
      'Suggesting price: €48.90 (margin 34%)',
      'Checking EU dropshipping compliance…',
      'Mapping category → Fashion / Outerwear',
      'Translating listing to 14 languages…',
      'Compressing & upscaling 6 photos…',
      'Syncing stock across 12 channels…',
    ],
  },
  marquee: [
    [
      'List this sneaker on Amazon, eBay and Etsy',
      'Write a German description with EU size chart',
      'Repricing: stay 2% under the buy box',
      'Bundle these 3 SKUs into one offer',
      'Find a legal EU dropshipping supplier',
    ],
    [
      'Generate 8 studio photos from this snapshot',
      'Open a B2B wholesale catalog for retailers',
      'Sync stock across all channels every 5 min',
      'Draft VAT-compliant invoices automatically',
      'Launch a storefront for my 240 products',
    ],
  ],
}

const tr: LandingContent = {
  nav: { how: 'Nasıl Çalışır', marketplaces: 'Pazaryerleri', solutions: 'Çözümler', pricing: 'Fiyatlandırma' },
  cta: {
    signIn: 'Giriş Yap',
    startFree: 'Ücretsiz Başla',
    startTrial: 'Ücretsiz denemeye başla',
    watch: 'AI’ı izle',
    demo: 'Demo planla',
    talkSales: 'Satışla görüş',
    panel: 'Panele Git',
  },
  hero: {
    badge: 'Uçtan uca yapay zekâ ürün yönetimi',
    title1: 'Ürününün fotoğrafını çek.',
    title2: 'Her yerde sat.',
    body: 'Rahatio tek bir telefon fotoğrafını eksiksiz, mevzuata uygun ve çok dilli bir ürün ilanına dönüştürür — sonra tüm pazaryerlerinde, kendi mağazanda, B2B portalında ve dropshipping ağında yayınlar.',
  },
  stats: [
    { value: '12sn', label: 'fotoğraf → canlı ilan' },
    { value: '40+', label: 'pazaryeri entegrasyonu' },
    { value: '14', label: 'dilde içerik' },
    { value: '%98,4', label: 'özellik doğruluğu' },
  ],
  how: {
    heading: 'Raftan mağazaya dört otomatik adımda',
    body: 'Ürün beslemesi yok, CSV eşleştirmesi yok, metin yazarı yok. Sıkıcı %90’ı yapay zekâ hattı yapıyor.',
    steps: [
      { title: 'Çek', body: 'Rahatio mobil uygulamasında fotoğraf çek — stüdyo ve tablo yok.' },
      { title: 'Analiz', body: 'Görüntü yapay zekâsı ürünü tanır ve 60+ yapısal özellikle zenginleştirir.' },
      { title: 'Üret', body: '14 dilde kanala uygun başlık, açıklama, anahtar kelime ve fiyat.' },
      { title: 'Yayınla', body: 'Tek dokunuşla her yerde yayına alınır ve stok senkron kalır.' },
    ],
  },
  features: {
    heading: 'Dokuz araç yerine tek platform',
    items: [
      { icon: 'bot', title: 'Yapay Zekâ Ürün Yönetimi', body: 'Tek fotoğraf eksiksiz ürün kaydına dönüşür: özellikler, kategori, durum, fiyat ve çok dilli metin.' },
      { icon: 'earth', title: 'Pazaryeri Entegrasyonları', body: 'Kanal kurallarına, kategori ağaçlarına ve görsel formatlarına uygun şekilde tüm büyük pazaryerlerine yayınla ve senkronize et.' },
      { icon: 'shopping-bag', title: 'Anında E-Ticaret', body: 'Aynı katalogdan kendi markalı mağazanı aç — ödeme ve kargo dahil.' },
      { icon: 'handshake', title: 'B2B Toptan', body: 'Kademeli fiyat listeleri, teklif talepleri, vadeli ödeme ve bayilere özel katalog.' },
      { icon: 'truck', title: 'Yasal Dropshipping', body: 'Denetlenmiş tedarikçiler, sözleşme şablonları, KDV yönetimi ve pazar bazlı uyum kontrolleri.' },
      { icon: 'chart-line', title: 'Fiyatlama & Analiz', body: 'Canlı kâr takibi, rakip bazlı fiyatlama ve tüm kanallarda talep tahmini.' },
    ],
  },
  markets: {
    heading: 'Sattığın her kanalla entegre',
    body: 'Yerel konnektörler her pazaryerinin kategori yapısını, görsel kurallarını ve sipariş akışını yönetir.',
    names: ['Amazon', 'eBay', 'Etsy', 'Shopify', 'Walmart', 'Trendyol', 'N11', 'Pazarama', 'Allegro', 'Zalando', 'Otto', 'Cdiscount', 'Bol.com', 'TikTok Shop'],
  },
  solutions: [
    {
      icon: 'boxes',
      tag: 'Katalog',
      title: 'Ürün verine sen sahip ol',
      body: 'Versiyonlama, toplu düzenleme ve her SKU için yapay zekâ kalite puanı olan tek doğru kaynak.',
      points: ['60+ otomatik özellik', 'Mükerrer tespiti', 'Görsel temizleme & büyütme'],
    },
    {
      icon: 'package-check',
      tag: 'Lojistik',
      title: 'Her yerden gönder',
      body: 'Deponu, 3PL’ini veya dropshipping tedarikçilerini bağla, her siparişi otomatik yönlendir.',
      points: ['Tedarikçi yönlendirme', 'Canlı stok senkronu', 'Kargo takibi geri yazımı'],
    },
    {
      icon: 'shield-check',
      tag: 'Uyumluluk',
      title: 'Hukuki tahmin yürütmeden sat',
      body: 'Yerleşik AB/ABD uyumu: KDV, GPSR, iade politikaları ve pazar bazlı tedarikçi sözleşmeleri.',
      points: ['KDV & faturalama', 'GPSR kontrolleri', 'Sözleşme şablonları'],
    },
  ],
  pricing: {
    heading: 'Basit ve ölçeklenebilir fiyatlandırma',
    body: '14 gün ücretsiz deneme. Kart gerekmez. İstediğin an iptal et.',
    popular: 'En popüler',
    perMonth: '/ay',
    plans: [
      {
        name: 'Başlangıç',
        price: '€39',
        body: 'Yapay zekâ ilanını küçük ölçekte deneyen bireysel satıcılar için.',
        points: ['Aylık 500 AI ilan', '3 pazaryeri kanalı', '1 mağaza', 'E-posta desteği'],
        cta: 'startFree',
      },
      {
        name: 'Büyüme',
        price: '€149',
        body: 'Çok kanalda satan büyüyen markalar için.',
        points: ['Aylık 10.000 AI ilan', 'Sınırsız kanal', 'B2B toptan portalı', 'Fiyatlama motoru', 'Öncelikli destek'],
        cta: 'startFree',
      },
      {
        name: 'Kurumsal',
        price: 'Özel',
        body: 'Distribütörler ve dropshipping ağları için.',
        points: ['Her şey sınırsız', 'Özel tedarikçi kurulumu', 'SLA & SSO', 'Özel yapay zekâ modelleri'],
        cta: 'talkSales',
      },
    ],
  },
  final: {
    title1: 'Bir sonraki ürün ilanın',
    title2: 'tek bir fotoğraf uzağında',
    body: 'Pazaryerleri, mağazalar, B2B ve dropshipping’de ekip büyütmeden daha hızlı büyüyen satıcılara katıl.',
  },
  footer: 'Rahatio. Modern ticaret için yapay zekâ ürün yönetimi.',
  scan: {
    steps: [
      { label: 'Fotoğraf çekildi', caption: 'Ürününü telefonunla fotoğrafla' },
      { label: 'Yapay zekâ analiz ediyor', caption: 'Kategori, marka, durum ve özellikler tespit ediliyor' },
      { label: 'İlan oluşturuldu', caption: '14 dilde başlık, açıklama, anahtar kelime ve fiyat' },
      { label: 'Her yerde yayında', caption: 'Bağlı tüm pazaryerlerinde canlı' },
    ],
    chips: ['Mont × %98', 'Marka tespit edildi', 'Etiketli sıfır'],
    live: '12 pazaryerinde yayında',
    prompts: [
      'Nesne silueti tanımlanıyor…',
      '240M ürün kataloğuyla eşleştiriliyor…',
      'Etiket okunuyor: pamuk karışımı, 320 gsm',
      'Durum tahmini: etiketli sıfır',
      'Amazon için SEO başlığı üretiliyor…',
      'eBay için madde işaretleri yazılıyor…',
      'Önerilen fiyat: €48,90 (kâr %34)',
      'AB dropshipping uyumu kontrol ediliyor…',
      'Kategori eşleşmesi → Moda / Dış Giyim',
      'İlan 14 dile çevriliyor…',
      '6 fotoğraf sıkıştırılıp büyütülüyor…',
      'Stok 12 kanalda senkronlanıyor…',
    ],
  },
  marquee: [
    [
      'Bu spor ayakkabıyı Amazon, N11 ve Trendyol’da listele',
      'AB beden tablosuyla Almanca açıklama yaz',
      'Fiyatlama: kutu fiyatının %2 altında kal',
      'Bu 3 SKU’yu tek pakette birleştir',
      'Yasal bir AB dropshipping tedarikçisi bul',
    ],
    [
      'Bu kareden 8 stüdyo fotoğrafı üret',
      'Bayiler için B2B toptan kataloğu aç',
      'Stokları her 5 dakikada tüm kanallarda eşitle',
      'KDV uyumlu faturaları otomatik oluştur',
      '240 ürünüm için mağaza aç',
    ],
  ],
}

const es: LandingContent = {
  nav: { how: 'Cómo funciona', marketplaces: 'Marketplaces', solutions: 'Soluciones', pricing: 'Precios' },
  cta: {
    signIn: 'Iniciar sesión',
    startFree: 'Empezar gratis',
    startTrial: 'Prueba gratuita',
    watch: 'Ver la IA en acción',
    demo: 'Reservar demo',
    talkSales: 'Hablar con ventas',
    panel: 'Ir al panel',
  },
  hero: {
    badge: 'Gestión de productos con IA, de principio a fin',
    title1: 'Fotografía un producto.',
    title2: 'Véndelo en todas partes.',
    body: 'Rahatio convierte una sola foto del móvil en una ficha completa, conforme y multilingüe — y la publica en todos los marketplaces, tu propia tienda, tu portal B2B y tu red de dropshipping.',
  },
  stats: [
    { value: '12s', label: 'foto → ficha publicada' },
    { value: '40+', label: 'integraciones de marketplace' },
    { value: '14', label: 'idiomas generados' },
    { value: '98,4%', label: 'precisión de atributos' },
  ],
  how: {
    heading: 'De la estantería a la tienda en cuatro pasos automáticos',
    body: 'Sin feeds de producto, sin mapeo CSV, sin copywriter. La IA hace el 90% aburrido.',
    steps: [
      { title: 'Foto', body: 'Haz una foto en la app móvil de Rahatio — sin estudio ni hojas de cálculo.' },
      { title: 'Analiza', body: 'La IA de visión identifica el producto y lo enriquece con más de 60 atributos.' },
      { title: 'Genera', body: 'Títulos, descripciones, keywords y precios listos por canal en 14 idiomas.' },
      { title: 'Publica', body: 'Un toque lo publica en todas partes y mantiene el stock sincronizado.' },
    ],
  },
  features: {
    heading: 'Una plataforma en lugar de nueve herramientas',
    items: [
      { icon: 'bot', title: 'Gestión de productos con IA', body: 'Una foto se convierte en una ficha completa: atributos, categoría, estado, precio y textos multilingües.' },
      { icon: 'earth', title: 'Integraciones de marketplace', body: 'Publica y sincroniza en todos los grandes marketplaces con sus reglas, taxonomías y formatos de imagen.' },
      { icon: 'shopping-bag', title: 'E-commerce instantáneo', body: 'Lanza tu propia tienda con el mismo catálogo — checkout, pagos y envíos incluidos.' },
      { icon: 'handshake', title: 'Mayorista B2B', body: 'Tarifas por niveles, solicitudes de presupuesto, pago aplazado y catálogo privado para tus distribuidores.' },
      { icon: 'truck', title: 'Dropshipping legal', body: 'Proveedores verificados, plantillas de contrato, gestión de IVA y controles de cumplimiento por mercado.' },
      { icon: 'chart-line', title: 'Repricing e insights', body: 'Margen en vivo, repricing frente a la competencia y previsión de demanda en todos tus canales.' },
    ],
  },
  markets: {
    heading: 'Integrado con todos los canales donde vendes',
    body: 'Los conectores nativos gestionan la taxonomía, las reglas de imagen y el ciclo de pedidos de cada marketplace.',
    names: ['Amazon', 'eBay', 'Etsy', 'Shopify', 'Walmart', 'Trendyol', 'N11', 'Pazarama', 'Allegro', 'Zalando', 'Otto', 'Cdiscount', 'Bol.com', 'TikTok Shop'],
  },
  solutions: [
    {
      icon: 'boxes',
      tag: 'Catálogo',
      title: 'Tus datos de producto son tuyos',
      body: 'Una única fuente de verdad con versionado, ediciones masivas y puntuación de calidad por IA en cada SKU.',
      points: ['60+ atributos automáticos', 'Detección de duplicados', 'Limpieza y mejora de imágenes'],
    },
    {
      icon: 'package-check',
      tag: 'Logística',
      title: 'Envía desde cualquier lugar',
      body: 'Conecta tu almacén, 3PL o proveedores de dropshipping y enruta cada pedido automáticamente.',
      points: ['Enrutado de proveedores', 'Stock en tiempo real', 'Devolución de tracking'],
    },
    {
      icon: 'shield-check',
      tag: 'Cumplimiento',
      title: 'Vende sin dudas legales',
      body: 'Cumplimiento UE/EE. UU. integrado: IVA, GPSR, políticas de devolución y contratos por mercado.',
      points: ['IVA y facturación', 'Controles GPSR', 'Plantillas de contrato'],
    },
  ],
  pricing: {
    heading: 'Precios simples y escalables',
    body: '14 días de prueba gratis. Sin tarjeta. Cancela cuando quieras.',
    popular: 'Más popular',
    perMonth: '/mes',
    plans: [
      {
        name: 'Starter',
        price: '39 €',
        body: 'Para vendedores individuales que prueban la IA a pequeña escala.',
        points: ['500 fichas IA / mes', '3 canales de marketplace', '1 tienda', 'Soporte por email'],
        cta: 'startFree',
      },
      {
        name: 'Growth',
        price: '149 €',
        body: 'Para marcas en crecimiento que venden en muchos canales.',
        points: ['10.000 fichas IA / mes', 'Canales ilimitados', 'Portal mayorista B2B', 'Motor de repricing', 'Soporte prioritario'],
        cta: 'startFree',
      },
      {
        name: 'Enterprise',
        price: 'A medida',
        body: 'Para distribuidores y redes de dropshipping.',
        points: ['Todo ilimitado', 'Onboarding de proveedores dedicado', 'SLA y SSO', 'Modelos de IA propios'],
        cta: 'talkSales',
      },
    ],
  },
  final: {
    title1: 'Tu próxima ficha de producto está',
    title2: 'a una foto de distancia',
    body: 'Únete a los vendedores que usan Rahatio para lanzar más rápido en marketplaces, tiendas, B2B y dropshipping — sin ampliar el equipo.',
  },
  footer: 'Rahatio. Gestión de productos con IA para el comercio moderno.',
  scan: {
    steps: [
      { label: 'Foto capturada', caption: 'Fotografía el producto con tu móvil' },
      { label: 'IA analizando', caption: 'Detectando categoría, marca, estado y atributos' },
      { label: 'Ficha generada', caption: 'Título, descripción, keywords y precio en 14 idiomas' },
      { label: 'Publicado en todas partes', caption: 'En vivo en todos los marketplaces conectados' },
    ],
    chips: ['Chaqueta × 98%', 'Marca detectada', 'Nuevo con etiquetas'],
    live: 'En vivo en 12 marketplaces',
    prompts: [
      'Identificando la silueta del objeto…',
      'Comparando con 240M de productos…',
      'Leyendo etiqueta: mezcla de algodón, 320 gsm',
      'Estado estimado: nuevo con etiquetas',
      'Generando título SEO para Amazon…',
      'Escribiendo bullets para eBay…',
      'Precio sugerido: 48,90 € (margen 34%)',
      'Comprobando cumplimiento de dropshipping UE…',
      'Categoría → Moda / Abrigos',
      'Traduciendo la ficha a 14 idiomas…',
      'Comprimiendo y mejorando 6 fotos…',
      'Sincronizando stock en 12 canales…',
    ],
  },
  marquee: [
    [
      'Publica esta zapatilla en Amazon, eBay y Etsy',
      'Escribe una descripción en alemán con tallas UE',
      'Repricing: 2% por debajo de la buy box',
      'Agrupa estos 3 SKU en una oferta',
      'Encuentra un proveedor legal de dropshipping en la UE',
    ],
    [
      'Genera 8 fotos de estudio desde esta imagen',
      'Abre un catálogo mayorista B2B para tiendas',
      'Sincroniza el stock cada 5 minutos',
      'Crea facturas conformes con el IVA',
      'Lanza una tienda para mis 240 productos',
    ],
  ],
}

export const LANDING_CONTENT: Record<Lang, LandingContent> = { en, tr, es }

export const LANDING_LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
  { code: 'es', label: 'ES' },
]

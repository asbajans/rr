import { ProductCategory } from '../types';

export interface SectorConfig {
  category: ProductCategory;
  label: string;
  /** What the vision stage should actively look for in the photo. */
  focus: string[];
  /** Attribute name → what to extract. Used to shape vision output and listing attributes. */
  attributeSchema: Record<string, string>;
  /** Title construction pattern for the listing stage. */
  titleTemplate: string;
  /** Copy rules + terminology guidance for the listing stage. */
  listingGuidance: string;
  /** Extra claim restrictions specific to this sector. */
  claimRestrictions?: string[];
}

const BASE_ATTRIBUTES: Record<string, string> = {
  Renk: 'dominant color(s) visible in the photo',
};

export const SECTOR_CONFIGS: Record<ProductCategory, SectorConfig> = {
  giyim: {
    category: 'giyim',
    label: 'Giyim & Tekstil',
    focus: [
      'yaka ve kol tipi (yakalı, round, polo, uzun kollu vb.)',
      'kalıp/kesim (regular, slim, oversize, bol vb.)',
      'kumaş dokusu ve bileşim etiketi',
      'beden etiketi, yıkama/bakım talimatı yazıları',
      'sezon (yazlık, kışlık, kısa/uzun kollu)',
      'kapatma şekli (fermuar, düğme, kanca)',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Yaka Tipi': 'collar/neck type if visible',
      'Kol Tipi': 'sleeve type if visible',
      Kalıp: 'fit/cut (regular, slim, oversize)',
      'Kumaş Bileşimi': 'fabric composition read from label if visible',
      Beden: 'size read from tag if visible',
      Sezon: 'season the garment is suited for',
      Desen: 'pattern if any',
    },
    titleTemplate: '[Cinsiyet] [Tür] [Stil] [Renk] [Kumaş]',
    listingGuidance:
      'Kumaş bileşimi, yaka/kol tipi, kalıp ve sezon bilgilerini açıklamada doğal biçimde kullan. Beden/kumaş yazısı okunabildiyse belirt.',
  },
  taki: {
    category: 'taki',
    label: 'Takı & Mücevher',
    focus: [
      'ayar/milyem damgası (925, 750, 18K, 22K vb.)',
      'taş tipi, kesim ve rengi',
      'zincir tipi ve uzunluğu',
      'kaplama bilgisi (rodyum, altın kaplama vb.)',
      'kapatma mekanizması (tokalı, sürgülü, klips)',
      'üzerindeki gravür/kod yazıları',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Milyem/Ayar': 'gold/silver purity stamp if visible (925, 750, 18K etc.)',
      Taş: 'stone type if visible',
      'Zincir Tipi': 'chain type if visible',
      Kaplama: 'plating/coating info if visible',
      Uzunluk: 'chain/length in cm if inferrable',
      'Kapatma Tipi': 'clasp mechanism',
    },
    titleTemplate: '[Tür] [Taş] [Ayar/Milyem] [Renk]',
    listingGuidance:
      'Milyem/ayar damgası ve taş bilgisi gerçekçi başlık için kritiktir. Damga okunamadıysa kesinlikle uydurma; belirsizliği warnings\'e ekle.',
    claimRestrictions: ['metal saflığı/ayarı damga görünmeden beyan edilmemeli'],
  },
  kozmetik: {
    category: 'kozmetik',
    label: 'Kozmetik & Kişisel Bakım',
    focus: [
      'ürün tipi (serum, krem, ruj, parfüm vb.)',
      'ton/rengi ve hacmi (ml/gr)',
      'cilt tipi ve kullanım alanı yazıları',
      'içerik/aktif bileşen etiketi',
      'ambalaj üzerindeki marka/model yazıları',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Ürün Tipi': 'product form (serum, cream, lipstick, perfume)',
      Ton: 'shade/tone if visible',
      Hacim: 'volume/weight in ml or gr read from label',
      'Cilt Tipi': 'skin type read from label if visible',
      Form: 'texture/form if visible',
    },
    titleTemplate: '[Marka] [Ürün Tipi] [Ton] [Hacim]',
    listingGuidance:
      'Hacim, ton ve ürün tipini açıklamada net ver. Marka görünmüyorsa boş bırak, uydurma.',
    claimRestrictions: [
      'tıbbi veya güvenlik iddiası yapılmamalı (kırışıklık giderir, leke çıkarır vb.)',
      'içerik iddiası sadece etikette okunan bileşenlerle sınırlı',
    ],
  },
  ayakkabi: {
    category: 'ayakkabi',
    label: 'Ayakkabı',
    focus: [
      'numara/ölçü etiketi ve iç taban yazıları',
      'taban tipi (kaymaz, yumuşak, topuklu) ve topuk yüksekliği',
      'materyal (deri, suni deri, tekstil, kauçuk)',
      'bağlama şekli (bağcıklı, çıtçıtlı, slip-on)',
      'sezon ve kullanım amacı',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      Numara: 'size read from label/insole if visible',
      Taban: 'sole type if visible',
      Topuk: 'heel height if inferrable',
      Materyal: 'upper material',
      'Bağlama Tipi': 'closure (lace, strap, slip-on)',
    },
    titleTemplate: '[Cinsiyet] [Tür] [Stil] [Renk] [Materyal]',
    listingGuidance:
      'Numara etiketi okunabildiyse başlık/açıklamada belirt. Materyal ve taban özelliklerini açıkça yaz.',
  },
  canta: {
    category: 'canta',
    label: 'Çanta & Aksesuar',
    focus: [
      'kapatma tipi (fermuar, manyetik, toka)',
      'sap/askı tipi ve uzunluğu',
      'iç bölme ve cepler',
      'materyal ve doku',
      'marka logosu/yazısı',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Kapatma Tipi': 'closure type',
      Sap: 'handle/strap type',
      Materyal: 'material',
      Boyut: 'dimensions if inferrable',
      'İç Bölme': 'inner compartments if visible',
    },
    titleTemplate: '[Tür] [Stil] [Renk] [Materyal]',
    listingGuidance:
      'Kapatma, sap tipi ve materyali açıklamada detaylandır. Marka logosu görünüyorsa belirt, değilse uydurma.',
  },
  elektronik: {
    category: 'elektronik',
    label: 'Elektronik',
    focus: [
      'model numarası, seri numarası ve parça kodları (etiketteki tüm alfanumerik kodlar)',
      'bağlantı noktaları (USB, HDMI, kulaklık, şarj)',
      'ekran tipi/boyutu ve çözünürlük',
      'güç/kapasite bilgisi (mAh, W, V)',
      'marka ve model adı',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Model No': 'model number read from label if visible',
      'Seri No': 'serial number if visible',
      'Parça Kodu': 'part/ref code if visible',
      Bağlantı: 'ports/connectivity visible',
      Güç: 'power/capacity info if visible',
    },
    titleTemplate: '[Marka] [Tür] [Model No] [Renk]',
    listingGuidance:
      'Model/parça/seri kodları fotoğrafta görünüyorsa attributes ve açıklamada aynen aktar. Kod okunamadıysa uydurma.',
  },
  ev_dekorasyon: {
    category: 'ev_dekorasyon',
    label: 'Ev & Dekorasyon',
    focus: [
      'materyal ve doku (seramik, ahşap, metal, cam)',
      'boyut/ölçü bilgisi',
      'stil (modern, klasik, bohem, rustik)',
      'kullanım alanı (salon, mutfak, bahçe)',
      'üzerindeki yazı/kod/desen',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      Materyal: 'material',
      Stil: 'style (modern, classic, bohemian, rustic)',
      Boyut: 'dimensions if inferrable',
      'Kullanım Alanı': 'intended room/usage',
      Desen: 'pattern/design if any',
    },
    titleTemplate: '[Tür] [Stil] [Renk] [Materyal]',
    listingGuidance:
      'Materyal, boyut ve kullanım alanını açıklamada net ver. Ölçü tahmini ise warnings\'e ekle.',
  },
  spor: {
    category: 'spor',
    label: 'Spor & Outdoor',
    focus: [
      'ürün tipi (ağırlık, mat, top, giyim vb.)',
      'materyal ve dayanıklılık detayları',
      'direnç/ağırlık/değer yazıları (kg, lb, ölçü)',
      'kullanım alanı (salon, outdoor, fitness)',
      'marka ve model yazıları',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      'Ürün Tipi': 'product type',
      Materyal: 'material',
      Ölçü: 'weight/size values read from label if visible',
      'Kullanım Alanı': 'usage context (gym, outdoor, fitness)',
      Model: 'model name if visible',
    },
    titleTemplate: '[Tür] [Materyal] [Renk] [Ölçü]',
    listingGuidance:
      'Etiketteki ağırlık/ölçü değerlerini aynen aktar. Kullanım alanı önerisini açıklamada belirt.',
  },
  diger: {
    category: 'diger',
    label: 'Diğer Ürünler',
    focus: [
      'materyal ve yapım',
      'boyut/ölçü bilgisi',
      'marka, model ve üzerindeki tüm yazı/kodlar',
      'renk ve stil',
      'kullanım amacı',
    ],
    attributeSchema: {
      ...BASE_ATTRIBUTES,
      Materyal: 'material',
      Boyut: 'dimensions if inferrable',
      Marka: 'brand if visible',
      Model: 'model/ref code if visible',
      'Kullanım Alanı': 'usage context',
    },
    titleTemplate: '[Tür] [Stil] [Renk] [Materyal]',
    listingGuidance:
      'Ürünü tarif eden tüm görünür detayları aktar; emin olunmayan bilgiyi warnings\'e ekle.',
  },
};

export function getSectorConfig(category: ProductCategory | string): SectorConfig {
  return SECTOR_CONFIGS[category as ProductCategory] ?? SECTOR_CONFIGS.diger;
}

export function formatCodes(codes: ProductCodeLike[] | undefined): string {
  if (!codes || codes.length === 0) return '';
  return codes
    .filter((c) => c && typeof c.value === 'string' && c.value.trim())
    .map((c) => `- ${c.type}: ${c.value.trim()}${typeof c.confidence === 'number' ? ` (güven: ${Math.round(c.confidence * 100)}%)` : ''}`)
    .join('\n');
}

interface ProductCodeLike {
  type: string;
  value: string;
  confidence?: number;
}
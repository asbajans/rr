import { AiProvider, AiModel, AiScenario } from '../../models/AiModels.js';
import { Plan } from '../../models/Plan.model.js';
import { Setting } from '../../models/Setting.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Default AI catalog seeded on boot. Idempotent: only creates missing
 * provider/models and (for scenarios) applies the recommended model every
 * boot, so the platform always starts with sensible model assignments.
 */

const OPENROUTER = {
  code: 'openrouter',
  name: 'OpenRouter',
  type: 'llm',
  baseUrl: 'https://openrouter.ai/api/v1',
  authConfig: { authType: 'bearer' },
};

interface DefaultModel {
  modelId: string;
  displayName: string;
  modality: string;
  tier: 'free' | 'paid';
  maxTokens: number;
}

const DEFAULT_MODELS: DefaultModel[] = [
  // Free tier — use only models that actually exist on OpenRouter (Gemma 4 does not exist)
  { modelId: 'google/gemma-3-27b-it:free', displayName: 'Gemma 3 27B (Free)', modality: 'vision', tier: 'free', maxTokens: 131072 },
  { modelId: 'google/gemma-3-12b-it:free', displayName: 'Gemma 3 12B (Free)', modality: 'vision', tier: 'free', maxTokens: 131072 },
  { modelId: 'meta-llama/llama-3.2-11b-vision-instruct:free', displayName: 'Llama 3.2 11B Vision (Free)', modality: 'vision', tier: 'free', maxTokens: 131072 },
  { modelId: 'qwen/qwen2.5-vl-32b-instruct:free', displayName: 'Qwen2.5 VL 32B (Free)', modality: 'vision', tier: 'free', maxTokens: 32768 },
  { modelId: 'google/gemini-2.0-flash-exp:free', displayName: 'Gemini 2.0 Flash Exp (Free)', modality: 'multimodal', tier: 'free', maxTokens: 1048576 },
  { modelId: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1 (Free)', modality: 'chat', tier: 'free', maxTokens: 65536 },
  // Paid tier
  { modelId: 'qwen/qwen3.7-flash', displayName: 'Qwen 3.7 Flash', modality: 'multimodal', tier: 'paid', maxTokens: 1048576 },
  { modelId: 'deepseek/deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', modality: 'chat', tier: 'paid', maxTokens: 1048576 },
  { modelId: 'google/gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', modality: 'multimodal', tier: 'paid', maxTokens: 1048576 },
  { modelId: 'openai/gpt-oss-120b', displayName: 'GPT-OSS 120B', modality: 'chat', tier: 'paid', maxTokens: 131072 },
  // Image generation models (external provider path; no ComfyUI required)
  { modelId: 'openai/gpt-image-1', displayName: 'OpenAI GPT Image 1', modality: 'image', tier: 'paid', maxTokens: 0 },
  { modelId: 'google/gemini-2.5-flash-image', displayName: 'Gemini 2.5 Flash Image', modality: 'image', tier: 'paid', maxTokens: 0 },
];

const SCENARIO_DEFAULTS: Record<string, { name: string; description: string; paidModel: string; freeModel: string; costCredits: number }> = {
  analyze_product: {
    name: 'Ürün Analizi',
    description: 'Ürün görselinden kategori ve özellik çıkarımı',
    paidModel: 'qwen/qwen3.5-flash',
    freeModel: 'google/gemma-3-27b-it:free',
    costCredits: 10,
  },
  process_image: {
    name: 'Görsel İşleme',
    description: 'Görsel analiz / arka plan temizleme',
    paidModel: 'google/gemini-2.0-flash-exp:free',
    freeModel: 'google/gemma-3-12b-it:free',
    costCredits: 5,
  },
  generate_image: {
    name: 'Görsel Üretme',
    description: 'Harici sağlayıcılarla yeni ürün görseli üretme / düzenleme',
    paidModel: 'google/gemini-2.5-flash-image',
    freeModel: 'google/gemini-2.5-flash-image',
    costCredits: 3,
  },
  agentic_listing: {
    name: 'Agentik İlan',
    description: 'Fotoğraftan tam ilan taslağı oluşturma',
    paidModel: 'google/gemini-3-flash-preview',
    freeModel: 'google/gemma-3-27b-it:free',
    costCredits: 12,
  },
  blog_generation: {
    name: 'Blog Üretimi',
    description: 'Konu/ürün bilgisinden SEO uyumlu blog yazısı oluşturma',
    paidModel: 'google/gemini-3-flash-preview',
    freeModel: 'google/gemma-3-12b-it:free',
    costCredits: 8,
  },
  generate_description: {
    name: 'Açıklama Üretme',
    description: 'Başlık ve özelliklerden SEO açıklama',
    paidModel: 'google/gemini-3-flash-preview',
    freeModel: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    costCredits: 3,
  },
  chat: {
    name: 'Sohbet',
    description: 'Müşteri destek / ürün soruları',
    paidModel: 'deepseek/deepseek-v4-flash',
    freeModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    costCredits: 1,
  },
  search: {
    name: 'Arama',
    description: 'Semantik ürün arama',
    paidModel: 'deepseek/deepseek-v4-flash',
    freeModel: 'inclusionai/ling-3.0-flash:free',
    costCredits: 2,
  },
  recommend: {
    name: 'Öneri',
    description: 'Çapraz satış / ürün önerileri',
    paidModel: 'qwen/qwen3.7-flash',
    freeModel: 'inclusionai/ling-3.0-flash:free',
    costCredits: 2,
  },
};

async function ensureProvider(): Promise<AiProvider | null> {
  const [provider] = await AiProvider.findOrCreate({
    where: { code: OPENROUTER.code },
    defaults: { ...OPENROUTER } as any,
  });
  const needsBaseUrl = !provider.baseUrl || provider.baseUrl !== OPENROUTER.baseUrl;
  if (needsBaseUrl || !provider.authConfig) {
    await provider.update({ baseUrl: OPENROUTER.baseUrl, authConfig: OPENROUTER.authConfig, isActive: true });
  }
  return provider;
}

async function ensureModels(providerId: number): Promise<Map<string, AiModel>> {
  const byModelId = new Map<string, AiModel>();
  for (const m of DEFAULT_MODELS) {
    const [model] = await AiModel.findOrCreate({
      where: { providerId, modelId: m.modelId },
      defaults: { ...m, providerId } as any,
    });
    const update: any = { tier: m.tier, modality: m.modality, isActive: true };
    if (!model.displayName) update.displayName = m.displayName;
    if (!model.maxTokens) update.maxTokens = m.maxTokens;
    await model.update(update);
    byModelId.set(m.modelId, model);
  }
  return byModelId;
}

async function ensureScenarios(providerId: number, byModelId: Map<string, AiModel>): Promise<void> {
  for (const [code, def] of Object.entries(SCENARIO_DEFAULTS)) {
    const paidModel = byModelId.get(def.paidModel);
    if (!paidModel) {
      logger.warn({ scenario: code, model: def.paidModel }, 'Default scenario model missing; skipping scenario');
      continue;
    }
    let scenario = await AiScenario.findOne({ where: { code } });
    const data: any = {
      modelId: paidModel.id,
      providerId,
      costCredits: def.costCredits,
      isActive: true,
      name: def.name,
      description: def.description,
      parameters: { temperature: 0.7, max_tokens: 2000 },
    };
    if (scenario) {
      await scenario.update(data);
    } else {
      scenario = await AiScenario.create({ code, ...data });
    }
  }
}

async function ensureFreePlanOverrides(byModelId: Map<string, AiModel>): Promise<void> {
  const freePlan = await Plan.findOne({ where: { name: 'Free' } });
  if (!freePlan) return;
  const overrides: Record<string, number | null> = {};
  let changed = false;
  for (const [code, def] of Object.entries(SCENARIO_DEFAULTS)) {
    const freeModel = byModelId.get(def.freeModel);
    const current = (freePlan as any).aiScenarioModels?.[code] ?? null;
    if (!freeModel) {
      overrides[code] = null;
      if (current !== null) changed = true;
      continue;
    }
    overrides[code] = freeModel.id;
    if (current !== freeModel.id) changed = true;
  }
  if (changed) {
    await freePlan.update({ aiScenarioModels: overrides });
  }
}

async function ensureGlobalSettings(provider: AiProvider, byModelId: Map<string, AiModel>): Promise<void> {
  const row = await Setting.findByPk('ai');
  const val = row?.value || {};
  const needsDefault = !val.defaultProviderId || !val.defaultModelId;
  if (!needsDefault) return;
  const defaultModel = byModelId.get('google/gemini-3-flash-preview');
  const next = { ...val };
  if (!val.defaultProviderId) next.defaultProviderId = provider.id;
  if (!val.defaultModelId && defaultModel) next.defaultModelId = defaultModel.id;
  if (row) {
    await row.update({ value: next });
  } else {
    await Setting.create({ key: 'ai', value: next });
  }
}

export async function seedAiDefaults(): Promise<void> {
  try {
    const provider = await ensureProvider();
    if (!provider) return;
    const byModelId = await ensureModels(provider.id);
    await ensureScenarios(provider.id, byModelId);
    await ensureFreePlanOverrides(byModelId);
    await ensureGlobalSettings(provider, byModelId);
    logger.info('AI defaults seeded (provider/models/scenarios/plan overrides)');
  } catch (err) {
    logger.warn({ err }, 'AI defaults seeding skipped');
  }
}

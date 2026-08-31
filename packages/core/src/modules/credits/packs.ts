import { Setting } from '../../models/Setting.model.js';

export type CreditPack = { credits: number; price: number; popular?: boolean; label?: string };

const DEFAULT_PACKS: CreditPack[] = [
  { credits: 50, price: 50 },
  { credits: 200, price: 150, popular: true },
  { credits: 500, price: 300 },
];

const KEY = 'credit_packs';

export function validatePacks(packs: any): { valid: boolean; error?: string; packs?: CreditPack[] } {
  if (!Array.isArray(packs)) return { valid: false, error: 'Packs must be an array' };
  if (packs.length === 0) return { valid: false, error: 'At least one pack required' };
  if (packs.length > 10) return { valid: false, error: 'Max 10 packs' };
  const out: CreditPack[] = [];
  const seen = new Set<number>();
  for (const p of packs) {
    const credits = Number(p.credits);
    const price = Number(p.price);
    if (!Number.isInteger(credits) || credits <= 0) return { valid: false, error: `Invalid credits: ${p.credits}` };
    if (!Number.isFinite(price) || price < 0) return { valid: false, error: `Invalid price: ${p.price}` };
    if (seen.has(credits)) return { valid: false, error: `Duplicate credits value: ${credits}` };
    seen.add(credits);
    out.push({ credits, price, popular: !!p.popular, label: p.label ? String(p.label) : undefined });
  }
  out.sort((a, b) => a.credits - b.credits);
  return { valid: true, packs: out };
}

export async function getCreditPacks(): Promise<CreditPack[]> {
  try {
    const row = await Setting.findByPk(KEY);
    if (row && Array.isArray((row as any).value)) {
      const v = validatePacks((row as any).value);
      if (v.valid && v.packs) return v.packs;
    }
  } catch {}
  return DEFAULT_PACKS;
}

export async function setCreditPacks(packs: CreditPack[]): Promise<CreditPack[]> {
  const v = validatePacks(packs);
  if (!v.valid) throw new Error(v.error);
  await Setting.upsert({ key: KEY, value: v.packs });
  return v.packs!;
}

export function getDefaultPacks(): CreditPack[] {
  return [...DEFAULT_PACKS];
}

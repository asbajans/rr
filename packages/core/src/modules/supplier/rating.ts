import { Op } from 'sequelize';
import { Supplier } from '../../models/Supplier.model.js';
import { SupplierRating } from '../../models/SupplierRating.model.js';
import { Setting } from '../../models/Setting.model.js';
import { sequelize } from '../../config/database.js';

const SETTING_KEY = 'supplier_ratings';

export interface RatingSettings {
  enabled: boolean;
}

/**
 * Global rating system toggle (stored in Setting JSONB). Defaults to enabled.
 */
export async function getRatingSettings(): Promise<RatingSettings> {
  const row = await Setting.findByPk(SETTING_KEY);
  if (!row || row.value === null || row.value === undefined) return { enabled: true };
  const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  return { enabled: val?.enabled !== false };
}

export async function setRatingSettings(enabled: boolean): Promise<RatingSettings> {
  await Setting.upsert({ key: SETTING_KEY, value: { enabled } });
  return { enabled };
}

export async function isRatingEnabled(): Promise<boolean> {
  return (await getRatingSettings()).enabled;
}

/**
 * Recompute the supplier's aggregate rating from its ratings. Called after
 * create/update/delete so Supplier.ratingAvg / ratingCount stay in sync.
 */
export async function recomputeSupplierRating(supplierId: number): Promise<{ ratingAvg: number; ratingCount: number }> {
  const agg = (await SupplierRating.findOne({
    where: { supplierId },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avg'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    raw: true,
  })) as unknown as { avg: string | null; count: string } | null;

  const avg = agg && agg.avg != null ? Number(agg.avg) : 0;
  const count = agg ? Number(agg.count) || 0 : 0;
  const ratingAvg = Math.round(avg * 100) / 100;
  await Supplier.update({ ratingAvg, ratingCount: count }, { where: { id: supplierId } });
  return { ratingAvg, ratingCount: count };
}

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Variation, VariationOption } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const variationRoutes: Router = Router();

const VALID_TYPES = ['color', 'size', 'material', 'style', 'custom'];
// Legacy frontend values ('select', 'text') map to 'custom'
const normalizeType = (t: unknown) =>
  t === 'select' || t === 'text' ? 'custom' : t;

const normalizeOptions = (options: unknown): string[] => {
  if (!Array.isArray(options)) return [];
  return (options as any[])
    .map((o) => (typeof o === 'string' ? o : o?.value))
    .filter((v) => typeof v === 'string' && v.trim().length > 0);
};

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

variationRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variations = await Variation.findAll({
      where: { storeId: store.id },
      order: [['createdAt', 'DESC']],
      include: [{ model: VariationOption, as: 'options', order: [['sortOrder', 'ASC']] }],
    });
    res.json({ variations });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List variations error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('type').custom((v) => {
    if (!VALID_TYPES.includes(String(normalizeType(v)))) throw new Error('Invalid type');
    return true;
  }),
  body('options').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { name } = req.body;
    const type = normalizeType(req.body.type);
    const values = normalizeOptions(req.body.options);

    const variation = await Variation.create({ storeId: store.id, name, type: type as string });

    if (values.length > 0) {
      await VariationOption.bulkCreate(values.map((value: string, index: number) => ({
        variationId: variation.id,
        value,
        sortOrder: index,
      })));
    }

    const fullVariation = await Variation.findByPk(variation.id, {
      include: [{ model: VariationOption, as: 'options', order: [['sortOrder', 'ASC']] }],
    });

    logger.info(`Variation created: ${variation.id} (${variation.name})`);
    res.status(201).json({ variation: fullVariation });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create variation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({
      where: { id: req.params.id, storeId: store.id },
      include: [{ model: VariationOption, as: 'options', order: [['sortOrder', 'ASC']] }],
    });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    res.json({ variation });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get variation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('type').optional().custom((v) => VALID_TYPES.includes(String(normalizeType(v)))),
  body('options').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });

    const patch: any = {};
    if (req.body.name !== undefined) patch.name = req.body.name;
    if (req.body.type !== undefined) patch.type = normalizeType(req.body.type);
    await variation.update(patch);

    // Sync options when provided (replace all)
    if (req.body.options !== undefined) {
      const values = normalizeOptions(req.body.options);
      await VariationOption.destroy({ where: { variationId: variation.id } });
      if (values.length > 0) {
        await VariationOption.bulkCreate(values.map((value: string, index: number) => ({
          variationId: variation.id,
          value,
          sortOrder: index,
        })));
      }
    }
    const fullVariation = await Variation.findByPk(variation.id, {
      include: [{ model: VariationOption, as: 'options', order: [['sortOrder', 'ASC']] }],
    });
    logger.info(`Variation updated: ${variation.id}`);
    res.json({ variation: fullVariation });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update variation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    await variation.destroy();
    logger.info(`Variation deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete variation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.post('/:id/options', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('value').isString().isLength({ min: 1, max: 200 }),
  body('sortOrder').optional().isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });

    const option = await VariationOption.create({
      variationId: variation.id,
      value: req.body.value,
      sortOrder: req.body.sortOrder || 0,
    });

    logger.info(`Variation option created: ${option.id}`);
    res.status(201).json({ option });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create variation option error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.put('/:id/options/:optionId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  param('optionId').isInt(),
  body('value').optional().isString().isLength({ min: 1, max: 200 }),
  body('sortOrder').optional().isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });

    const option = await VariationOption.findOne({ where: { id: req.params.optionId, variationId: variation.id } });
    if (!option) return res.status(404).json({ error: 'Option not found' });

    await option.update(req.body);
    logger.info(`Variation option updated: ${option.id}`);
    res.json({ option });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update variation option error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

variationRoutes.delete('/:id/options/:optionId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  param('optionId').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const variation = await Variation.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!variation) return res.status(404).json({ error: 'Variation not found' });

    const option = await VariationOption.findOne({ where: { id: req.params.optionId, variationId: variation.id } });
    if (!option) return res.status(404).json({ error: 'Option not found' });

    await option.destroy();
    logger.info(`Variation option deleted: ${req.params.optionId}`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete variation option error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StoreLocation } from '../../models/ContentModels.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const locationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

type LocationRow = {
  id: number;
  storeId: number;
  name: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  working_hours?: string[] | null;
  is_primary?: boolean | null;
  coordinates?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  isActive?: boolean | null;
  createdAt?: Date | string;
};

export function serializeLocation(l: LocationRow) {
  const coords = l.coordinates || {};
  const lat = l.latitude != null ? Number(l.latitude) : (coords.lat != null ? Number(coords.lat) : (coords.latitude != null ? Number(coords.latitude) : null));
  const lng = l.longitude != null ? Number(l.longitude) : (coords.lng != null ? Number(coords.lng) : (coords.longitude != null ? Number(coords.longitude) : null));
  return {
    id: Number(l.id),
    store_id: Number(l.storeId),
    name: l.name,
    latitude: lat,
    longitude: lng,
    address: l.address || '',
    city: l.city || '',
    country: l.country || '',
    phone: l.phone || null,
    working_hours: Array.isArray(l.working_hours) ? l.working_hours : null,
    is_primary: !!l.is_primary,
    created_at: l.createdAt ? new Date(l.createdAt).toISOString() : null,
  };
}

function resolveLatLng(body: any): { latitude: number | null; longitude: number | null } {
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (body.latitude !== undefined && body.latitude !== null && body.latitude !== '') latitude = Number(body.latitude);
  if (body.longitude !== undefined && body.longitude !== null && body.longitude !== '') longitude = Number(body.longitude);
  const coords = body.coordinates;
  if (coords && (latitude == null || longitude == null)) {
    if (coords.lat !== undefined) latitude = Number(coords.lat);
    if (coords.lng !== undefined) longitude = Number(coords.lng);
    if (coords.latitude !== undefined) latitude = Number(coords.latitude);
    if (coords.longitude !== undefined) longitude = Number(coords.longitude);
  }
  return {
    latitude: latitude != null && isFinite(latitude) ? latitude : null,
    longitude: longitude != null && isFinite(longitude) ? longitude : null,
  };
}

locationRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const where: any = { storeId: store.id };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const locations = await StoreLocation.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json({ locations: locations.map(serializeLocation) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List locations error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 255 }),
  body('address').optional().isString(),
  body('latitude').optional().isNumeric(),
  body('longitude').optional().isNumeric(),
  body('coordinates').optional().isObject(),
  body('city').optional().isString(),
  body('country').optional().isString(),
  body('phone').optional().isString(),
  body('working_hours').optional().isArray(),
  body('is_primary').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { latitude, longitude } = resolveLatLng(req.body);

    const location = await StoreLocation.create({
      storeId: store.id,
      name: req.body.name,
      address: req.body.address || null,
      latitude,
      longitude,
      city: req.body.city || null,
      country: req.body.country || null,
      phone: req.body.phone || null,
      working_hours: Array.isArray(req.body.working_hours) ? req.body.working_hours : null,
      is_primary: req.body.is_primary !== undefined ? req.body.is_primary : false,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    logger.info(`Location created: ${location.id} (${location.name}) by store ${store.id}`);
    res.status(201).json({ location: serializeLocation(location) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ location: serializeLocation(location) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 255 }),
  body('address').optional().isString(),
  body('latitude').optional().isNumeric(),
  body('longitude').optional().isNumeric(),
  body('coordinates').optional().isObject(),
  body('city').optional().isString(),
  body('country').optional().isString(),
  body('phone').optional().isString(),
  body('working_hours').optional().isArray(),
  body('is_primary').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updateData: any = { ...req.body };
    const { latitude, longitude } = resolveLatLng(req.body);
    if (latitude != null) updateData.latitude = latitude;
    if (longitude != null) updateData.longitude = longitude;
    delete updateData.coordinates;
    if (updateData.working_hours !== undefined && !Array.isArray(updateData.working_hours)) delete updateData.working_hours;

    await location.update(updateData);
    logger.info(`Location updated: ${location.id} (${location.name})`);
    res.json({ location: serializeLocation(location) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

locationRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const location = await StoreLocation.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await location.destroy();
    logger.info(`Location deleted: ${req.params.id} (store: ${store.id})`);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete location error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

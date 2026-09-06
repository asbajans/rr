import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { SupportTicket, SupportTicketMessage } from '../../models/SupportTicket.model.js';
import { Store } from '../../models/Store.model.js';
import { User } from '../../models/User.model.js';
import { StoreNotification } from '../../models/StoreNotification.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

function generateCode(): string {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RHT-${hex}`;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const exists = await SupportTicket.findOne({ where: { code } });
    if (!exists) return code;
  }
  return `RHT-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}-${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

// Seller routes
export const sellerSupportRoutes: Router = Router();
sellerSupportRoutes.use(authMiddleware, requireStore);

sellerSupportRoutes.post(
  '/tickets',
  [
    body('category').isIn(['bug', 'support', 'feedback']),
    body('subject').isString().trim().isLength({ min: 5, max: 200 }),
    body('message').isString().trim().isLength({ min: 10, max: 5000 }),
    body('screenshots').optional().isArray({ max: 3 }),
    body('screenshots.*').optional().isString().isLength({ max: 600 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const user = (req as any).user;
      const { category, subject, message, screenshots } = req.body;
      let pics: string[] | null = null;
      if (Array.isArray(screenshots) && screenshots.length > 0) {
        pics = screenshots.slice(0, 3).map((s: string) => String(s).trim()).filter(Boolean);
        if (pics.length === 0) pics = null;
      }
      const code = await uniqueCode();
      const ticket = await SupportTicket.create({
        code,
        storeId: store.id,
        userId: user.id,
        category,
        subject: String(subject).trim(),
        message: String(message).trim(),
        screenshots: pics,
        status: 'open',
      } as any);
      // notify superadmins via in-app? store superadmin users not store scoped, skip for now
      res.status(201).json({ ticket });
    } catch (e) {
      logger.error({ err: e }, 'Create support ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

sellerSupportRoutes.get(
  '/tickets',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['open', 'pending', 'resolved', 'closed']),
    query('category').optional().isIn(['bug', 'support', 'feedback']),
    query('search').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const offset = (page - 1) * limit;
      const where: any = { storeId: store.id };
      if (req.query.status) where.status = req.query.status;
      if (req.query.category) where.category = req.query.category;
      if (req.query.search) {
        const s = String(req.query.search).trim();
        where[Op.or] = [
          { code: { [Op.iLike]: `%${s}%` } },
          { subject: { [Op.iLike]: `%${s}%` } },
        ];
      }
      const { count, rows } = await SupportTicket.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [{ model: SupportTicketMessage, as: 'messages', separate: true, order: [['createdAt', 'ASC']] }],
      });
      res.json({ tickets: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
    } catch (e) {
      logger.error({ err: e }, 'List support tickets error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

sellerSupportRoutes.get(
  '/tickets/:code',
  [param('code').isString().trim().isLength({ min: 6, max: 20 })],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({
        where: { code, storeId: store.id },
        include: [{ model: SupportTicketMessage, as: 'messages', order: [['createdAt', 'ASC']] } as any],
      });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      // ensure messages ordered
      const messages = await SupportTicketMessage.findAll({ where: { ticketId: ticket.id }, order: [['createdAt', 'ASC']] });
      (ticket as any).setDataValue('messages', messages);
      res.json({ ticket });
    } catch (e) {
      logger.error({ err: e }, 'Get support ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

sellerSupportRoutes.post(
  '/tickets/:code/messages',
  [
    param('code').isString().trim().isLength({ min: 6, max: 20 }),
    body('body').isString().trim().isLength({ min: 1, max: 5000 }),
    body('attachments').optional().isArray({ max: 3 }),
    body('attachments.*').optional().isString().isLength({ max: 600 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const user = (req as any).user;
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({ where: { code, storeId: store.id } });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      if (ticket.status === 'closed') return res.status(400).json({ error: 'TICKET_CLOSED' });
      let atts2: string[] | null = null;
      if (Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
        const tmp = req.body.attachments.slice(0, 3).map((s: string) => String(s).trim()).filter(Boolean);
        atts2 = tmp.length ? tmp : null;
      }
      const msg = await SupportTicketMessage.create({
        ticketId: ticket.id,
        senderType: 'seller',
        senderId: user.id,
        body: String(req.body.body).trim(),
        attachments: atts2,
      } as any);
      if (ticket.status === 'resolved') await ticket.update({ status: 'pending' });
      else if (ticket.status === 'open') await ticket.update({ status: 'pending' });
      res.status(201).json({ message: msg });
    } catch (e) {
      logger.error({ err: e }, 'Seller reply ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

sellerSupportRoutes.post(
  '/tickets/:code/close',
  [param('code').isString().trim().isLength({ min: 6, max: 20 })],
  validate,
  async (req: Request, res: Response) => {
    try {
      const store = (req as any).store;
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({ where: { code, storeId: store.id } });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      if (ticket.status === 'closed') return res.json({ ticket });
      await ticket.update({ status: 'closed', closedAt: new Date() });
      res.json({ ticket });
    } catch (e) {
      logger.error({ err: e }, 'Close ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Superadmin routes
export const superSupportRoutes: Router = Router();
superSupportRoutes.use(authMiddleware, requireRole('superadmin'));

superSupportRoutes.get(
  '/tickets',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['open', 'pending', 'resolved', 'closed']),
    query('category').optional().isIn(['bug', 'support', 'feedback']),
    query('storeId').optional().isInt({ min: 1 }),
    query('search').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const offset = (page - 1) * limit;
      const where: any = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.category) where.category = req.query.category;
      if (req.query.storeId) where.storeId = parseInt(req.query.storeId as string);
      if (req.query.search) {
        const s = String(req.query.search).trim();
        where[Op.or] = [
          { code: { [Op.iLike]: `%${s}%` } },
          { subject: { [Op.iLike]: `%${s}%` } },
          { message: { [Op.iLike]: `%${s}%` } },
        ];
      }
      const { count, rows } = await SupportTicket.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [
          { model: Store, as: 'store', attributes: ['id', 'name', 'siteCode', 'email'] },
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        ],
      });
      res.json({ tickets: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
    } catch (e) {
      logger.error({ err: e }, 'Super list tickets error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

superSupportRoutes.get(
  '/tickets/:code',
  [param('code').isString().trim().isLength({ min: 6, max: 20 })],
  validate,
  async (req: Request, res: Response) => {
    try {
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({
        where: { code },
        include: [
          { model: Store, as: 'store', attributes: ['id', 'name', 'siteCode', 'email'] },
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        ],
      });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      const messages = await SupportTicketMessage.findAll({ where: { ticketId: ticket.id }, order: [['createdAt', 'ASC']] });
      (ticket as any).setDataValue('messages', messages);
      res.json({ ticket });
    } catch (e) {
      logger.error({ err: e }, 'Super get ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

superSupportRoutes.patch(
  '/tickets/:code',
  [
    param('code').isString().trim().isLength({ min: 6, max: 20 }),
    body('status').optional().isIn(['open', 'pending', 'resolved', 'closed']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('assignedTo').optional({ values: 'null' }).isInt({ min: 1 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({ where: { code } });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      const patch: any = {};
      if (req.body.status) {
        patch.status = req.body.status;
        if (req.body.status === 'closed') patch.closedAt = new Date();
        else patch.closedAt = null;
      }
      if (req.body.priority) patch.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) patch.assignedTo = req.body.assignedTo;
      if (Object.keys(patch).length) await ticket.update(patch);
      res.json({ ticket });
    } catch (e) {
      logger.error({ err: e }, 'Super patch ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

superSupportRoutes.post(
  '/tickets/:code/messages',
  [
    param('code').isString().trim().isLength({ min: 6, max: 20 }),
    body('body').isString().trim().isLength({ min: 1, max: 5000 }),
    body('attachments').optional().isArray({ max: 3 }),
    body('attachments.*').optional().isString().isLength({ max: 600 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const code = String(req.params.code).toUpperCase().trim();
      const ticket = await SupportTicket.findOne({ where: { code } });
      if (!ticket) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      if (ticket.status === 'closed') return res.status(400).json({ error: 'TICKET_CLOSED' });
      let atts3: string[] | null = null;
      if (Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
        const tmp = req.body.attachments.slice(0, 3).map((s: string) => String(s).trim()).filter(Boolean);
        atts3 = tmp.length ? tmp : null;
      }
      const msg = await SupportTicketMessage.create({
        ticketId: ticket.id,
        senderType: 'superadmin',
        senderId: user.id,
        body: String(req.body.body).trim(),
        attachments: atts3,
      } as any);
      if (ticket.status !== 'resolved') await ticket.update({ status: 'pending' });
      // notify seller store
      try {
        await StoreNotification.create({
          storeId: ticket.storeId,
          userId: null,
          type: 'support',
          title: `Destek yanıtı: ${ticket.code}`,
          body: String(req.body.body).slice(0, 200),
          data: { ticketCode: ticket.code, ticketId: ticket.id },
        } as any);
      } catch {}
      res.status(201).json({ message: msg });
    } catch (e) {
      logger.error({ err: e }, 'Super reply ticket error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

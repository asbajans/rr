import { Router, Request, Response } from 'express';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { verifyTrendyolSignature, verifyHepsiburadaSignature, verifyPazaramaSignature, verifyN11Signature, verifyAmazonSignature, verifyEtsySignature } from '../utils/webhookVerify.js';
import { orderQueue, stockQueue, priceQueue } from '../queues/index.js';

export const webhookRoutes = Router();

webhookRoutes.post('/trendyol', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-trendyol-signature'] as string;
    if (!verifyTrendyolSignature(req.body, signature, config.marketplace.trendyol.apiSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { eventType, orderId, productId, quantity } = req.body;
    
    if (eventType === 'ORDER_CREATED') {
      await orderQueue.add('order-created', { marketplace: 'trendyol', orderId, payload: req.body });
    } else if (eventType === 'STOCK_UPDATE') {
      await stockQueue.add('stock-update', { marketplace: 'trendyol', productId, quantity, payload: req.body });
    } else if (eventType === 'PRICE_UPDATE') {
      await priceQueue.add('price-update', { marketplace: 'trendyol', productId, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('Trendyol webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRoutes.post('/hepsiburada', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hb-signature'] as string;
    if (!verifyHepsiburadaSignature(req.body, signature, config.marketplace.hepsiburada.password)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, orderId, productId, quantity } = req.body;
    
    if (type === 'ORDER_CREATED') {
      await orderQueue.add('order-created', { marketplace: 'hepsiburada', orderId, payload: req.body });
    } else if (type === 'STOCK_CHANGED') {
      await stockQueue.add('stock-update', { marketplace: 'hepsiburada', productId, quantity, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('Hepsiburada webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRoutes.post('/pazarama', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-pazarama-signature'] as string;
    if (!verifyPazaramaSignature(req.body, signature, config.marketplace.pazarama.apiKey)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, orderId, productId, quantity } = req.body;
    
    if (event === 'order.created') {
      await orderQueue.add('order-created', { marketplace: 'pazarama', orderId, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('Pazarama webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRoutes.post('/n11', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-n11-signature'] as string;
    if (!verifyN11Signature(req.body, signature, config.marketplace.n11.appSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { eventType, orderId, productId } = req.body;
    
    if (eventType === 'ORDER_CREATE') {
      await orderQueue.add('order-created', { marketplace: 'n11', orderId, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('N11 webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRoutes.post('/amazon', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-amz-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    if (!verifyAmazonSignature(payload, signature, config.marketplace.amazon.awsSecretKey)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { eventType, orderId } = req.body;
    
    if (eventType === 'OrderCreated') {
      await orderQueue.add('order-created', { marketplace: 'amazon', orderId, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('Amazon webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRoutes.post('/etsy', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-etsy-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    if (!verifyEtsySignature(payload, signature, config.marketplace.etsy.clientSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, orderId, listingId } = req.body;
    
    if (event === 'order.created') {
      await orderQueue.add('order-created', { marketplace: 'etsy', orderId, payload: req.body });
    }
    
    res.json({ received: true });
  } catch (err) {
    logger.error('Etsy webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
/**
 * Storefront checkout contract shared by web, mobile and core.
 * Backend is the single source of truth for pricing, stock, tax and shipping —
 * the client only sends product references and quantities (AGENTOPEN.md Faz 6).
 */

import { z } from 'zod';

export const CheckoutItemSchema = z.object({
  product_id: z.number().int().positive(),
  sku: z.string().trim().optional(),
  quantity: z.number().int().positive(),
});

export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

export const CheckoutShippingAddressSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  city: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  address: z.string().min(1).max(1000),
  zip_code: z.string().optional().default(''),
});

export type CheckoutShippingAddress = z.infer<typeof CheckoutShippingAddressSchema>;

export const CheckoutCustomerSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
});

export type CheckoutCustomer = z.infer<typeof CheckoutCustomerSchema>;

export const PAYMENT_METHODS = [
  'stripe',
  'iyzico',
  'paytr',
  'bank_transfer',
  'cash_on_delivery',
  'crypto',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CheckoutPayloadSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1),
  shipping_address: CheckoutShippingAddressSchema,
  customer: CheckoutCustomerSchema.default({}),
  payment_method: z.enum(PAYMENT_METHODS),
  address_id: z.number().int().positive().optional(),
  note: z.string().max(2000).optional(),
  /** Honeypot — bots auto-fill hidden fields; the real frontend never sends it. */
  website: z.string().max(100).optional().default(''),
});

export type CheckoutPayload = z.infer<typeof CheckoutPayloadSchema>;

export type CheckoutTotals = {
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxMode: 'included' | 'excluded' | 'none';
  taxRate: number;
};

export type CheckoutResult = {
  orderId: number;
  orderNumber: string;
  orderToken: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'awaiting';
  requiresPaymentGateway: boolean;
  totals: CheckoutTotals;
  message: string;
};

/** Gateway payment providers (order payments). */
export const PAYMENT_PROVIDERS = ['stripe', 'iyzico', 'paytr'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const REQUIRES_GATEWAY = (method: string): boolean =>
  (PAYMENT_PROVIDERS as readonly string[]).includes(method);

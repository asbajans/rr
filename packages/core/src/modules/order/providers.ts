import type { DropshippingOrder } from '../../models/DropshippingOrder.model.js';

export type InvoiceResult = { invoiceNumber?: string; invoiceUrl?: string | null; status: 'issued' | 'manual' };
export type ShippingLabelResult = { labelUrl?: string | null; labelZpl?: string | null; cargoCompany?: string | null; status: 'created' | 'manual' };

export interface InvoiceProvider {
  issue(order: DropshippingOrder): Promise<InvoiceResult>;
}
export interface ShippingLabelProvider {
  create(order: DropshippingOrder): Promise<ShippingLabelResult>;
}

class ManualInvoiceProvider implements InvoiceProvider {
  async issue(order: DropshippingOrder): Promise<InvoiceResult> {
    return { invoiceUrl: order.invoiceUrl || null, status: order.invoiceUrl ? 'issued' : 'manual' };
  }
}
class ManualShippingLabelProvider implements ShippingLabelProvider {
  async create(order: DropshippingOrder): Promise<ShippingLabelResult> {
    return { labelUrl: order.labelUrl || null, labelZpl: order.labelZpl || null, cargoCompany: order.cargoCompany || null, status: order.labelUrl || order.labelZpl ? 'created' : 'manual' };
  }
}

export function createInvoiceProvider(name = 'manual'): InvoiceProvider {
  if (name === 'manual') return new ManualInvoiceProvider();
  throw new Error(`Unsupported invoice provider: ${name}`);
}
export function createShippingLabelProvider(name = 'manual'): ShippingLabelProvider {
  if (name === 'manual') return new ManualShippingLabelProvider();
  throw new Error(`Unsupported shipping label provider: ${name}`);
}

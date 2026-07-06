import { Order, OrderDTO } from '../types';

export function mapToOrderDTO(order: Order): OrderDTO {
  const subtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return {
    externalId: order.id,
    marketplace: order.marketplace,
    status: mapStatus(order.status),
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
    },
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      currency: 'TRY',
    })),
    totals: {
      subtotal,
      shipping: 0,
      tax: Math.round(subtotal * 0.2),
      grandTotal: Math.round(subtotal * 1.2),
    },
    createdAt: order.createdAt,
  };
}

function mapStatus(status: string): string {
  const map: Record<string, string> = {
    Created: 'pending',
    Picking: 'processing',
    Invoiced: 'confirmed',
    Shipped: 'shipped',
    Delivered: 'delivered',
    Cancelled: 'cancelled',
    Returned: 'returned',
  };
  return map[status] || status.toLowerCase();
}

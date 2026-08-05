import { StripeGateway } from './stripe.js';
import { IyzicoGateway } from './iyzico.js';
import { PayTRGateway } from './paytr.js';
import type { PaymentGateway } from './types.js';

export function createGateway(type: string): PaymentGateway | null {
  switch (type) {
    case 'stripe':
      return new StripeGateway();
    case 'iyzico':
      return new IyzicoGateway();
    case 'paytr':
      return new PayTRGateway();
    default:
      return null;
  }
}

export type { PaymentGateway, GatewayPaymentRequest, GatewayPaymentResult, GatewayWebhookResult, GatewayRefundResult } from './types.js';

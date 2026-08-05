import type { DropshippingOrder } from '../../../models/DropshippingOrder.model.js';
import type { Store } from '../../../models/Store.model.js';
import type { StorePaymentMethod } from '../../../models/ContentModels.js';

export interface GatewayPaymentRequest {
  order: DropshippingOrder;
  store: Store;
  method: StorePaymentMethod;
  /** Where the customer should land after payment completes (frontend result page). */
  returnUrl: string;
  /** Server callback endpoint that confirms the order and redirects back to returnUrl. */
  callbackUrl?: string;
  ipAddress: string;
  customer: { email: string; name: string; phone: string };
}

export interface GatewayPaymentResult {
  provider: string;
  requiresRedirect: boolean;
  /** Stripe PaymentIntent client_secret */
  clientToken?: string;
  /** iyzico 3DS payment page / PayTR iframe URL */
  paymentUrl?: string;
  /** Provider payment reference */
  refId?: string;
  expiresAt?: number;
}

export interface GatewayWebhookResult {
  orderId?: number;
  success: boolean;
  refId: string;
  raw: unknown;
}

export interface GatewayRefundResult {
  success: boolean;
  refId: string;
}

export interface PaymentGateway {
  createPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResult>;
  parseWebhook(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    secret: string
  ): Promise<GatewayWebhookResult>;
  refund(
    order: DropshippingOrder,
    method: StorePaymentMethod,
    amount?: number,
    reason?: string
  ): Promise<GatewayRefundResult>;
}

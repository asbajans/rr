import { Customer } from '../../models/Customer.model.js';
import { CustomerNotification } from '../../models/CustomerNotification.model.js';

export type CustomerNotificationInput = { type: string; title: string; body: string; metadata?: object };
export interface EmailProvider { send(to: string, subject: string, body: string): Promise<void>; }
export interface SmsProvider { send(to: string, body: string): Promise<void>; }
export interface PushProvider { send(customerId: number, title: string, body: string, metadata?: object): Promise<void>; }

class NoopEmailProvider implements EmailProvider { async send() {} }
class NoopSmsProvider implements SmsProvider { async send() {} }
class NoopPushProvider implements PushProvider { async send() {} }

export function notificationProviders() {
  return { email: new NoopEmailProvider(), sms: new NoopSmsProvider(), push: new NoopPushProvider() };
}

export async function notifyCustomer(customer: Customer, input: CustomerNotificationInput) {
  const notification = await CustomerNotification.create({ storeId: customer.storeId, customerId: customer.id, type: input.type, title: input.title, body: input.body, metadata: input.metadata || null, readAt: null });
  const providers = notificationProviders();
  await Promise.allSettled([
    providers.email.send(customer.email, input.title, input.body),
    customer.phone ? providers.sms.send(customer.phone, input.body) : Promise.resolve(),
    providers.push.send(customer.id, input.title, input.body, input.metadata),
  ]);
  return notification;
}

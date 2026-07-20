import crypto from 'crypto';

export function verifyTrendyolSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyHepsiburadaSignature(payload: any, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyPazaramaSignature(payload: any, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyN11Signature(payload: string, signature: string, appSecret: string): boolean {
  if (!appSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyAmazonSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyEtsySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
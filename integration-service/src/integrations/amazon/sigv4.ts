import crypto from 'crypto';
import axios from 'axios';

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface LwaCredentials {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

export async function getLwaAccessToken(creds: LwaCredentials, scope?: string): Promise<string> {
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  };
  if (scope) {
    params.scope = scope;
  } else {
    params.refresh_token = creds.refreshToken;
  }

  const res = await axios.post(LWA_TOKEN_URL, new URLSearchParams(params).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });

  return res.data.access_token;
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function signKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSHA256(secret, dateStamp);
  const kRegion = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  const kSigning = hmacSHA256(kService, 'aws4_request');
  return kSigning;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

export function signRequest(
  method: string,
  url: string,
  region: string,
  service: string,
  credentials: AwsCredentials,
  accessToken: string,
  body: string = ''
): SignedRequest {
  const u = new URL(url);
  const host = u.host;
  const canonicalUri = u.pathname || '/';
  const canonicalQuery = u.searchParams
    .toString()
    .split('&')
    .filter(Boolean)
    .sort()
    .join('&');

  const payloadHash = sha256Hex(body);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headersToSign: Record<string, string> = {
    host,
    'x-amz-access-token': accessToken,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  if (credentials.sessionToken) {
    headersToSign['x-amz-security-token'] = credentials.sessionToken;
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headersToSign[k]}\n`).join('');
  const signedHeaderNames = sortedHeaderKeys.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', signKey(credentials.secretAccessKey, dateStamp, region, service))
    .update(stringToSign)
    .digest('hex');

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  const finalHeaders: Record<string, string> = {
    ...headersToSign,
    Authorization: authorizationHeader,
  };

  const finalUrl = canonicalQuery ? `${url.split('?')[0]}?${canonicalQuery}` : url;

  return { url: finalUrl, headers: finalHeaders };
}

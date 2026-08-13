import AWS from 'aws-sdk';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * MinIO / S3 storage helper. All media (including AI-generated images uploaded
 * through /api/admin/upload) is stored in the configured bucket and served via
 * PUBLIC_MEDIA_URL (e.g. https://media.rahatio.com.tr). Falls back to the
 * caller when storage is not configured or the request fails.
 */

const PUBLIC_MEDIA_URL = (process.env.PUBLIC_MEDIA_URL || '').replace(/\/+$/, '');

let s3: AWS.S3 | null = null;

function configured(): boolean {
  const c = config.s3;
  return Boolean(c.endpoint && c.accessKey && c.secretKey);
}

function getS3(): AWS.S3 | null {
  if (!configured()) return null;
  if (!s3) {
    s3 = new AWS.S3({
      endpoint: config.s3.endpoint,
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
      s3ForcePathStyle: true, // required for MinIO
      signatureVersion: 'v4',
      region: config.s3.region,
    });
  }
  return s3;
}

export interface S3UploadResult {
  ok: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Uploads a buffer to the configured S3/MinIO bucket under `key`.
 * Returns a public URL when successful (PUBLIC_MEDIA_URL or the S3 endpoint URL).
 */
export async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<S3UploadResult> {
  const client = getS3();
  if (!client) {
    return { ok: false, error: 'S3 not configured' };
  }
  try {
    await client
      .putObject({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      })
      .promise();
    const base = PUBLIC_MEDIA_URL || `${config.s3.endpoint.replace(/\/+$/, '')}/${config.s3.bucket}`;
    return { ok: true, key, url: `${base}/${key}` };
  } catch (err: any) {
    logger.error({ err, key, bucket: config.s3.bucket, endpoint: config.s3.endpoint }, 'S3 upload failed');
    return { ok: false, key, error: err?.message || 'S3 upload failed' };
  }
}

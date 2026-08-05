import { describe, expect, it } from 'vitest';
import { getHostingProvider } from './providers.js';

describe('site hosting providers', () => {
  it('keeps Rahatio hosting immediately deployable', async () => {
    const provider = getHostingProvider('rahatio');
    expect(provider.kind).toBe('rahatio');
    await expect(provider.deploy({ storeId: 1, siteCode: 'demo' })).resolves.toMatchObject({ status: 'ready' });
  });

  it('does not silently treat unconfigured external providers as Rahatio', () => {
    expect(() => getHostingProvider('custom')).toThrow(/not configured/i);
  });
});

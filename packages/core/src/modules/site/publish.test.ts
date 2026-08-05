import { describe, it, expect } from 'vitest';
import {
  computeNextVersion,
  snapshotOf,
  resolveRollbackTarget,
} from './publish.js';

describe('site publish helpers (Faz 8)', () => {
  it('computeNextVersion starts at 1 and increments after published versions', () => {
    expect(computeNextVersion([])).toBe(1);
    expect(computeNextVersion([1])).toBe(2);
    expect(computeNextVersion([1, 3, 2])).toBe(4);
  });

  it('snapshotOf captures theme/siteCode/domain/siteUrl with null fallbacks', () => {
    const snap = snapshotOf({ theme: { primary_color: '#123456' }, siteCode: 'abc', domain: null, siteUrl: 'https://x' });
    expect(snap).toEqual({ themeSnapshot: { primary_color: '#123456' }, siteCode: 'abc', domain: null, siteUrl: 'https://x' });
    expect(snapshotOf({ siteCode: 'x' }).themeSnapshot).toEqual({});
  });

  it('resolveRollbackTarget restores snapshot but keeps current values when snapshot missing', () => {
    const current = { theme: { primary_color: '#000' }, siteCode: 'current', domain: 'cur.com', siteUrl: null };
    const target = { themeSnapshot: { primary_color: '#abc' }, siteCode: 'old', domain: null, siteUrl: 'https://old' };
    expect(resolveRollbackTarget(current, target)).toEqual({
      theme: { primary_color: '#abc' },
      siteCode: 'old',
      domain: null,
      siteUrl: 'https://old',
    });
    // snapshot present but no theme → keep current theme, still restore code/url
    const partial = { siteCode: 'old', siteUrl: null } as any;
    expect(resolveRollbackTarget(current, partial)).toEqual({
      theme: {},
      siteCode: 'old',
      domain: 'cur.com',
      siteUrl: null,
    });
  });
});

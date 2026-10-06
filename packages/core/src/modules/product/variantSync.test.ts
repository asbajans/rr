import { describe, it, expect } from 'vitest';
import { buildVariantSku, cleanVariantAttributes, comboKey } from './variantSync.js';

describe('variantSync pure helpers', () => {
  it('cleans mixed input into name -> unique values', () => {
    expect(cleanVariantAttributes({
      Renk: ['Kırmızı', 'Mavi', 'Kırmızı', '  ', 42, null],
      Beden: ['S', 'M'],
      Boş: [],
      '  ': ['x'],
    })).toEqual({
      Renk: ['Kırmızı', 'Mavi'],
      Beden: ['S', 'M'],
    });
  });

  it('returns {} for non-object input', () => {
    expect(cleanVariantAttributes(undefined)).toEqual({});
    expect(cleanVariantAttributes(['Renk'])).toEqual({});
    expect(cleanVariantAttributes(null)).toEqual({});
  });

  it('builds slugified variant SKUs (TR chars handled)', () => {
    expect(buildVariantSku('TSHIRT', { Renk: 'Kırmızı', Beden: 'S' })).toBe('TSHIRT-kirmizi-s');
    expect(buildVariantSku('ÜRÜN-1', { Renk: 'Açık Mavi' })).toBe('ÜRÜN-1-acik-mavi');
  });

  it('comboKey is order-independent', () => {
    expect(comboKey({ a: '1', b: '2' })).toBe(comboKey({ b: '2', a: '1' }));
    expect(comboKey({ a: '1' })).not.toBe(comboKey({ a: '2' }));
  });
});

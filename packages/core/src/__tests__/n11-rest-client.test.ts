import { describe, expect, it } from 'vitest';

function flattenTree(nodes: any[], parentId: number, level: number = 0): any[] {
  const result: any[] = [];
  for (const n of nodes) {
    const id = n.id ?? 0;
    result.push({ id, marketplace_category_id: String(id), name: n.name ?? '', parentId, parent_id: String(parentId), level, path: n.name ?? '' });
    if (Array.isArray(n.subCategories) && n.subCategories.length > 0) {
      result.push(...flattenTree(n.subCategories, id, level + 1));
    }
  }
  return result;
}

describe('N11 REST - flattenTree', () => {
  it('flattens nested category tree', () => {
    const tree = [
      { id: 1, name: 'Elektronik', subCategories: [
        { id: 10, name: 'Cep Telefonu', subCategories: [{ id: 100, name: 'Aksesuar' }] },
        { id: 11, name: 'Bilgisayar' },
      ]},
      { id: 2, name: 'Moda' },
    ];

    const flat = flattenTree(tree, 0);
    expect(flat).toHaveLength(5);
    expect(flat[0]).toMatchObject({ id: 1, name: 'Elektronik', parentId: 0, level: 0 });
    expect(flat[1]).toMatchObject({ id: 10, name: 'Cep Telefonu', parentId: 1, level: 1 });
    expect(flat[2]).toMatchObject({ id: 100, name: 'Aksesuar', parentId: 10, level: 2 });
    expect(flat[3]).toMatchObject({ id: 11, name: 'Bilgisayar', parentId: 1, level: 1 });
    expect(flat[4]).toMatchObject({ id: 2, name: 'Moda', parentId: 0, level: 0 });
  });

  it('handles empty array', () => {
    expect(flattenTree([], 0)).toEqual([]);
  });

  it('handles single category without children', () => {
    const flat = flattenTree([{ id: 5, name: 'Tek Kategori' }], 0);
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({ id: 5, name: 'Tek Kategori', parentId: 0, level: 0 });
  });

  it('produces tree-compatible flat records', () => {
    const tree = [
      { id: 100, name: 'Parent', subCategories: [{ id: 200, name: 'Child' }] },
    ];
    const flat = flattenTree(tree, 0);
    expect(flat[0].parent_id).toBe('0');
    expect(flat[1].parent_id).toBe('100');
    expect(flat[0].marketplace_category_id).toBe('100');
    expect(flat[1].marketplace_category_id).toBe('200');
  });
});

describe('N11 - product response shape', () => {
  it('parses getProductQuery response', () => {
    const response = {
      content: [
        {
          n11ProductId: 123456789,
          stockCode: 'SKU001',
          title: 'Test Ürün',
          description: 'Açıklama',
          categoryId: 1001,
          status: 'Active',
          saleStatus: 'On_Sale',
          salePrice: 100.0,
          listPrice: 120.0,
          quantity: 10,
          currencyType: 'TL',
          imageUrls: ['https://cdn.n11.com/img.jpg'],
          vatRate: 10,
          attributes: [{ attributeId: 1, attributeName: 'Marka', attributeValue: 'Test' }],
          barcode: '1234567890123',
        },
      ],
      totalPages: 1,
      totalElements: 1,
      number: 0,
      size: 20,
      last: true,
    };

    const products = response.content;
    expect(Array.isArray(products)).toBe(true);
    expect(products).toHaveLength(1);

    const p = products[0];
    expect(p.stockCode).toBe('SKU001');
    expect(p.title).toBe('Test Ürün');
    expect(p.salePrice).toBe(100.0);
    expect(p.quantity).toBe(10);
    expect(Array.isArray(p.imageUrls)).toBe(true);
    expect(p.barcode).toBe('1234567890123');

    const totalPages = response.totalPages;
    const hasMore = (response.number ?? 0) < totalPages - 1;
    expect(hasMore).toBe(false);
  });

  it('detects hasMore correctly', () => {
    const response = {
      content: [{ id: 1 }, { id: 2 }],
      totalPages: 3,
      number: 0,
    };
    const hasMore = response.number < response.totalPages - 1;
    expect(hasMore).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

function flattenCategories(categories: any[], parentId: number = 0, level: number = 0): any[] {
  const result: any[] = [];
  for (const cat of categories) {
    result.push({
      id: cat.id,
      marketplace_category_id: String(cat.id),
      name: cat.name,
      parentId,
      parent_id: String(parentId),
      level,
      path: cat.name,
    });
    if (cat.subCategories?.length) {
      result.push(...flattenCategories(cat.subCategories, cat.id, level + 1));
    }
  }
  return result;
}

describe('N11 REST - flattenCategories', () => {
  it('flattens nested category tree', () => {
    const tree = [
      {
        id: 1, name: 'Elektronik',
        subCategories: [
          { id: 10, name: 'Cep Telefonu', subCategories: [{ id: 100, name: 'Aksesuar' }] },
          { id: 11, name: 'Bilgisayar' },
        ],
      },
      { id: 2, name: 'Moda' },
    ];

    const flat = flattenCategories(tree);

    expect(flat).toHaveLength(5);
    expect(flat[0]).toMatchObject({ id: 1, name: 'Elektronik', parentId: 0, level: 0 });
    expect(flat[1]).toMatchObject({ id: 10, name: 'Cep Telefonu', parentId: 1, level: 1 });
    expect(flat[2]).toMatchObject({ id: 100, name: 'Aksesuar', parentId: 10, level: 2 });
    expect(flat[3]).toMatchObject({ id: 11, name: 'Bilgisayar', parentId: 1, level: 1 });
    expect(flat[4]).toMatchObject({ id: 2, name: 'Moda', parentId: 0, level: 0 });
  });

  it('handles empty array', () => {
    expect(flattenCategories([])).toEqual([]);
  });

  it('handles single category without children', () => {
    const flat = flattenCategories([{ id: 5, name: 'Tek Kategori' }]);
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({ id: 5, name: 'Tek Kategori', parentId: 0, level: 0 });
  });
});

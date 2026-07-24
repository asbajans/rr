import { describe, expect, it } from 'vitest';

function parseSoapXml(xml: string): any {
  const bodyMatch = xml.match(/<(?:soap:|env:)?Body>([\s\S]*?)<\/(?:soap:|env:)?Body>/i);
  if (!bodyMatch) return {};
  return parseXmlChildren(bodyMatch[1].trim());
}

function parseXmlChildren(xml: string): any {
  const result: any = {};
  const tagRegex = /<(\w+:)?(\w+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1\2>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(xml)) !== null) {
    const [, , tagName, tagContent] = m;
    const trimmed = tagContent.trim();
    if (/^<(\w+:)?\w+/.test(trimmed)) {
      const child = parseXmlChildren(trimmed);
      if (result[tagName]) {
        if (!Array.isArray(result[tagName])) result[tagName] = [result[tagName]];
        result[tagName].push(child);
      } else {
        result[tagName] = child;
      }
    } else {
      if (result[tagName]) {
        if (!Array.isArray(result[tagName])) result[tagName] = [result[tagName]];
        result[tagName].push(trimmed);
      } else {
        result[tagName] = trimmed;
      }
    }
  }
  return result;
}

describe('parseSoapXml', () => {
  it('parses category list response', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <categoryListResponse>
      <categoryList>
        <category>
          <id>1001</id>
          <name>Elektronik</name>
          <parentId>0</parentId>
        </category>
        <category>
          <id>2001</id>
          <name>Cep Telefonu</name>
          <parentId>1001</parentId>
        </category>
      </categoryList>
    </categoryListResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = parseSoapXml(xml);
    const cats = result?.categoryListResponse?.categoryList?.category;

    expect(Array.isArray(cats)).toBe(true);
    expect(cats).toHaveLength(2);
    expect(cats[0].id).toBe('1001');
    expect(cats[0].name).toBe('Elektronik');
    expect(cats[1].id).toBe('2001');
    expect(cats[1].name).toBe('Cep Telefonu');
    expect(cats[1].parentId).toBe('1001');
  });

  it('parses single category (non-array)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <categoryListResponse>
      <categoryList>
        <category>
          <id>1001</id>
          <name>Elektronik</name>
        </category>
      </categoryList>
    </categoryListResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = parseSoapXml(xml);
    const raw = result?.categoryListResponse?.categoryList?.category;
    const cats = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    expect(cats).toHaveLength(1);
    expect(cats[0].id).toBe('1001');
    expect(cats[0].name).toBe('Elektronik');
  });

  it('returns empty object for invalid XML', () => {
    expect(parseSoapXml('not xml')).toEqual({});
    expect(parseSoapXml('<root>no body</root>')).toEqual({});
  });

  it('parses product list response', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <productListResponse>
      <productList>
        <product>
          <id>12345</id>
          <title>Test Product</title>
          <price>99.99</price>
        </product>
      </productList>
    </productListResponse>
  </soap:Body>
</soap:Envelope>`;

    const result = parseSoapXml(xml);
    const raw = result?.productListResponse?.productList?.product;
    const products = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    expect(products).toHaveLength(1);
    expect(products[0].id).toBe('12345');
    expect(products[0].title).toBe('Test Product');
    expect(products[0].price).toBe('99.99');
  });
});

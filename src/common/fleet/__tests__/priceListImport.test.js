import { describe, expect, it } from 'vitest';
import { guessPriceColumns, parseKind, parsePriceList } from '../priceListImport';

describe('guessPriceColumns', () => {
  it('reads Hebrew and English headers', () => {
    expect(guessPriceColumns(['תיאור הפריט', 'סוג', 'מחיר מוסכם', 'סטייה %'])).toEqual({
      description: 0,
      kind: 1,
      unit_price: 2,
      tolerance_pct: 3,
    });
    expect(guessPriceColumns(['Item', 'Price', 'Valid from', 'Valid to'])).toMatchObject({
      description: 0,
      unit_price: 1,
      valid_from: 2,
      valid_to: 3,
    });
  });
});

describe('parseKind', () => {
  it('maps the usual words', () => {
    expect(parseKind('עבודה')).toBe('labor');
    expect(parseKind('חלקים')).toBe('part');
    expect(parseKind('Fee')).toBe('fee');
    expect(parseKind('')).toBeNull();
    expect(parseKind('משהו')).toBeNull();
  });
});

describe('parsePriceList', () => {
  const mapping = { description: 0, kind: 1, unit_price: 2, valid_from: 3 };

  it('adds new lines, updates known ones and reports the bad ones', () => {
    const rows = [
      ['תיאור', 'סוג', 'מחיר', 'בתוקף מ'],
      ['החלפת שמן', 'עבודה', '₪180', '01/01/2026'],
      ['פילטר שמן', 'חלק', '45.50', ''],
      ['x', 'חלק', '10', ''],
      ['רפידות בלם', 'חלק', 'לא ידוע', ''],
      ['פילטר  שמן', 'חלק', '46', ''],
      ['שטיפה', '', '1,200', ''],
    ];
    const existing = [{ id: 'p1', description: 'החלפת שמן', kind: 'labor' }];
    const result = parsePriceList(rows, mapping, existing);
    expect(result.lines).toEqual([
      {
        id: 'p1',
        description: 'החלפת שמן',
        kind: 'labor',
        unit_price: 180,
        tolerance_pct: 5,
        valid_from: '2026-01-01',
        valid_to: null,
      },
      expect.objectContaining({ id: null, description: 'פילטר שמן', unit_price: 45.5 }),
      expect.objectContaining({ id: null, description: 'שטיפה', kind: 'part', unit_price: 1200 }),
    ]);
    expect(result.errors).toEqual([
      { line: 4, error: 'description' },
      { line: 5, error: 'price' },
      { line: 6, error: 'duplicate' },
    ]);
    expect(result.added).toBe(2);
    expect(result.updated).toBe(1);
  });

  it('refuses an end before the start', () => {
    const rows = [
      ['a', 'b', 'c', 'd', 'e'],
      ['טיפול', 'עבודה', '100', '01/02/2026', '01/01/2026'],
    ];
    const result = parsePriceList(rows, { ...mapping, valid_to: 4 });
    expect(result.errors).toEqual([{ line: 2, error: 'dates' }]);
  });
});

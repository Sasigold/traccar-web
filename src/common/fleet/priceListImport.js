// ISR-13: a supplier's price list from a file (CSV or Excel). Pure, unit-tested.
//
// The supplier's columns are guessed from the headers (the person can correct them), every line
// becomes an agreed price, and a description already in the list (same kind) updates its price
// instead of adding a second line.

import { guessColumns, parseDate, parseNumber } from './fuelImport';

export const PRICE_FIELDS = [
  'description',
  'unit_price',
  'kind',
  'tolerance_pct',
  'valid_from',
  'valid_to',
];
export const REQUIRED_PRICE_FIELDS = ['description', 'unit_price'];

const HINTS = {
  description: ['תיאור', 'פריט', 'שם', 'מוצר', 'description', 'item', 'name', 'product'],
  unit_price: ['מחיר מוסכם', 'מחיר ליחידה', 'מחיר', 'עלות', 'price', 'cost', 'rate'],
  kind: ['סוג', 'קטגוריה', 'kind', 'type', 'category'],
  tolerance_pct: ['סטייה', 'סטיה', 'טולרנס', 'tolerance'],
  valid_from: ['בתוקף מ', 'מתאריך', 'החל מ', 'valid from', 'from'],
  valid_to: ['בתוקף עד', 'עד תאריך', 'valid to', 'until', 'to'],
};

export const guessPriceColumns = (headers) => guessColumns(headers, /** @type {any} */ (HINTS));

const KIND_WORDS = {
  labor: ['עבודה', 'שעת עבודה', 'שעות', 'labor', 'labour', 'work'],
  part: ['חלק', 'חלקים', 'חומר', 'part', 'parts', 'material'],
  fee: ['אגרה', 'עמלה', 'תשלום', 'שירות', 'fee', 'charge', 'service'],
};

export const parseKind = (value) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!text) return null;
  const match = Object.entries(KIND_WORDS).find(([, words]) =>
    words.some((word) => text === word || text.startsWith(word)),
  );
  return match ? match[0] : null;
};

const isoDate = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const descriptionKey = (description, kind) =>
  `${String(description ?? '')
    .toLowerCase()
    .replace(/[״"׳']/g, '')
    .replace(/\s+/g, ' ')
    .trim()}|${kind || ''}`;

/**
 * Rows (the first is the header) -> price lines and errors, against the existing list.
 * @param {any[][]} rows
 * @param {Record<string, number>} mapping field -> column index
 * @param {{ id: string, description: string, kind?: string | null }[]} existing
 * @param {{ defaultKind?: string, defaultTolerance?: number }} [options]
 */
export const parsePriceList = (
  rows,
  mapping,
  existing = [],
  { defaultKind = 'part', defaultTolerance = 5 } = {},
) => {
  const byKey = new Map(existing.map((row) => [descriptionKey(row.description, row.kind), row]));
  const seen = new Set();
  const lines = [];
  const errors = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const cell = (field) => (mapping[field] === undefined ? undefined : cells[mapping[field]]);
    const description = String(cell('description') ?? '').trim();
    const unitPrice = parseNumber(cell('unit_price'));
    if (description.length < 2 || description.length > 200) {
      errors.push({ line, error: 'description' });
      return;
    }
    if (unitPrice == null || unitPrice < 0) {
      errors.push({ line, error: 'price' });
      return;
    }
    const kind = parseKind(cell('kind')) || defaultKind;
    const tolerance = parseNumber(cell('tolerance_pct'));
    const validFrom = isoDate(cell('valid_from'));
    const validTo = isoDate(cell('valid_to'));
    if (validFrom && validTo && validTo < validFrom) {
      errors.push({ line, error: 'dates' });
      return;
    }
    const key = descriptionKey(description, kind);
    if (seen.has(key)) {
      errors.push({ line, error: 'duplicate' });
      return;
    }
    seen.add(key);
    lines.push({
      id: byKey.get(key)?.id || null,
      description,
      kind,
      unit_price: unitPrice,
      tolerance_pct:
        tolerance != null && tolerance >= 0 && tolerance <= 100 ? tolerance : defaultTolerance,
      valid_from: validFrom,
      valid_to: validTo,
    });
  });
  return {
    lines,
    errors,
    added: lines.filter((row) => !row.id).length,
    updated: lines.filter((row) => row.id).length,
  };
};

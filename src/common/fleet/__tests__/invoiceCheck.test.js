import { describe, expect, it } from 'vitest';
import { agreedPrice, checkInvoice, normalizeItem, overchargeTotal } from '../invoiceCheck';

const prices = [
  { vendor_id: 'g1', description: 'החלפת שמן', kind: 'labor', unit_price: 200, tolerance_pct: 0 },
  {
    vendor_id: null,
    description: 'רפידות בלם קדמיות',
    kind: 'part',
    unit_price: 350,
    tolerance_pct: 5,
  },
  {
    vendor_id: 'g1',
    description: 'רפידות בלם קדמיות',
    kind: 'part',
    unit_price: 320,
    tolerance_pct: 5,
    valid_to: '2026-01-31',
  },
];

describe('invoice check (ISR-13)', () => {
  it('compares descriptions loosely', () => {
    expect(normalizeItem(' רפידות-בלם  "קדמיות" ')).toBe('רפידות בלם קדמיות');
  });

  it('finds the agreed price: same vendor, valid on the date, then any vendor', () => {
    const pads = { description: 'רפידות בלם קדמיות', kind: 'part' };
    expect(agreedPrice(pads, prices, { vendorId: 'g1', date: '2026-01-10' }).unit_price).toBe(320);
    expect(agreedPrice(pads, prices, { vendorId: 'g1', date: '2026-11-10' }).unit_price).toBe(350);
    expect(
      agreedPrice({ description: 'החלפת שמן מנוע 5W30', kind: 'labor' }, prices, { vendorId: 'g1' })
        .unit_price,
    ).toBe(200);
    expect(
      agreedPrice({ description: 'שטיפה', kind: 'fee' }, prices, { vendorId: 'g1' }),
    ).toBeNull();
  });

  it('flags a price above the agreement, a line twice and an invoice billed before', () => {
    const order = {
      id: 'w2',
      vendor_id: 'g1',
      invoice_number: 'A-77',
      opened_at: '2026-11-01',
    };
    const items = [
      { description: 'החלפת שמן', kind: 'labor', quantity: 1, unit_price: 260 },
      { description: 'רפידות בלם קדמיות', kind: 'part', quantity: 2, unit_price: 360 },
      { description: 'רפידות בלם קדמיות', kind: 'part', quantity: 2, unit_price: 360 },
      { description: 'שטיפה', kind: 'fee', quantity: 1, unit_price: 50 },
    ];
    const findings = checkInvoice({
      order,
      items,
      prices,
      others: [{ id: 'w1', vendor_id: 'g1', invoice_number: 'A-77', number: 12 }],
    });
    const types = findings.map((finding) => finding.type);
    expect(types.filter((type) => type === 'overPrice')).toHaveLength(1);
    expect(findings.find((f) => f.type === 'overPrice')).toMatchObject({
      over: 60,
      overAmount: 60,
    });
    expect(types).toContain('duplicateLine');
    expect(types).toContain('noAgreement');
    expect(findings.find((f) => f.type === 'duplicateInvoice')).toMatchObject({
      orderId: 'w1',
      number: 12,
    });
    expect(overchargeTotal(findings)).toBe(60);
  });

  it('says nothing about missing agreements when there is no price list', () => {
    const findings = checkInvoice({
      order: { id: 'w3' },
      items: [{ description: 'משהו', unit_price: 10 }],
    });
    expect(findings).toEqual([]);
  });
});

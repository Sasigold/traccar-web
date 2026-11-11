import { describe, expect, it } from 'vitest';
import {
  buildTransactions,
  fuelMismatch,
  guessColumns,
  normalizePlate,
  parseCsv,
  parseDate,
  parseNumber,
  unknownPlates,
  withPlateAliases,
} from '../fuelImport';

describe('fuel import parsing', () => {
  it('reads CSV with quotes, BOM and semicolons', () => {
    expect(parseCsv('﻿a;b\r\n"x;1";"he said ""hi"""\n\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'he said "hi"'],
    ]);
  });

  it('reads numbers with shekel signs and thousands separators', () => {
    expect(parseNumber('₪ 1,234.50')).toBe(1234.5);
    expect(parseNumber('45,6')).toBe(45.6);
    expect(parseNumber(7)).toBe(7);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('reads day-first dates', () => {
    expect(parseDate('06/11/2026 14:30').toISOString()).toBe(
      new Date(2026, 10, 6, 14, 30).toISOString(),
    );
    expect(parseDate('6.11.26').getFullYear()).toBe(2026);
    expect(parseDate('2026-11-06T10:00:00Z').toISOString()).toBe('2026-11-06T10:00:00.000Z');
    expect(parseDate('yesterday')).toBeNull();
  });

  it('guesses Hebrew and English headers', () => {
    expect(
      guessColumns([
        'תאריך עסקה',
        'מספר רכב',
        'שם תחנה',
        'כמות ליטרים',
        'מחיר לליטר',
        'סה"כ לתשלום',
        'מספר עסקה',
        'סוג דלק',
      ]),
    ).toEqual({
      occurred_at: 0,
      plate_number: 1,
      station: 2,
      liters: 3,
      unit_price: 4,
      total: 5,
      external_id: 6,
      fuel_type: 7,
    });
    expect(guessColumns(['Date', 'Plate', 'Liters', 'Amount'])).toEqual({
      occurred_at: 0,
      plate_number: 1,
      liters: 2,
      total: 3,
    });
  });

  it('matches plates by digits only', () => {
    expect(normalizePlate('12-345-67')).toBe('1234567');
  });
});

describe('fuel transactions', () => {
  const vehicles = [
    { id: 'v1', plate: '12-345-67', fuelCapacity: 60, fuelType: 'diesel' },
    { id: 'v2', plate: '234-56-789', fuelType: 'petrol' },
  ];
  const mapping = { occurred_at: 0, plate_number: 1, liters: 2, total: 3, fuel_type: 4 };

  it('matches vehicles and flags anomalies', () => {
    const rows = [
      ['06/11/2026 08:00', '1234567', '50', '350', 'סולר'],
      ['06/11/2026 09:30', '12-345-67', '70', '490', 'סולר'],
      ['06/11/2026 10:00', '234-56-789', '40', '280', 'סולר'],
      ['06/11/2026 11:00', '99-999-99', '30', '210', 'בנזין 95'],
      ['bad', '1234567', '1', '', ''],
    ];
    const txs = buildTransactions(rows, mapping, vehicles);
    expect(txs.map((tx) => [tx.vehicle?.id ?? null, tx.flags, tx.errors])).toEqual([
      ['v1', [], []],
      ['v1', ['over_capacity', 'too_frequent'], []],
      ['v2', ['wrong_fuel'], []],
      [null, ['unknown_vehicle'], []],
      ['v1', [], ['date', 'total']],
    ]);
    expect(txs[0].unit_price).toBe(7);
  });

  it('knows which products clash with the vehicle fuel', () => {
    expect(fuelMismatch('diesel', 'בנזין 95')).toBe(true);
    expect(fuelMismatch('petrol', 'Unleaded 95')).toBe(false);
    expect(fuelMismatch('hybrid', 'סולר')).toBe(false);
    expect(fuelMismatch('electric', 'סולר')).toBe(true);
    expect(fuelMismatch('diesel', 'שטיפה')).toBe(false);
  });
});

describe('plates mapped by hand (ADM-18)', () => {
  it('lists each unknown plate once and matches it once mapped', () => {
    const vehicles = [{ id: 1, plate: '12-345-67', fuelCapacity: 60 }];
    const mapping = { occurred_at: 0, plate_number: 1, liters: 2, total: 3 };
    const rows = [
      ['2026-11-01 08:00', '99-888-77', '40', '280'],
      ['2026-11-02 08:00', '99-888-77', '30', '210'],
      ['2026-11-03 08:00', '12-345-67', '30', '210'],
    ];
    const before = buildTransactions(rows, mapping, vehicles);
    expect(unknownPlates(before)).toEqual(['9988877']);
    const after = buildTransactions(rows, mapping, withPlateAliases(vehicles, { 9988877: 1 }));
    expect(unknownPlates(after)).toEqual([]);
    expect(after[0].vehicle).toMatchObject({ id: 1, fuelCapacity: 60 });
  });
});

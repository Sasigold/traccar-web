import { describe, expect, it } from 'vitest';
import {
  TOLL_HINTS,
  chargeKey,
  chargeTotals,
  chargesByDriver,
  matchCharges,
  toCharges,
} from '../tolls';
import { guessColumns, parseDate, parseNumber } from '../fuelImport';

// ISR-06: toll and parking charges matched to the trip and the driver.
describe('tolls and parking', () => {
  it('reads a statement and matches each charge by plate and time', () => {
    const sheet = [
      ['תאריך ושעה', 'מספר רכב', 'קטע', 'סכום לתשלום'],
      ['09/11/2026 08:30', '12-345-67', 'כביש 6 · מחלף עירון', '18.90'],
      ['09/11/2026 22:00', '1234567', 'כביש 6', '5'],
      ['09/11/2026 08:30', '99-999-99', 'חניון', '7'],
    ];
    const mapping = guessColumns(sheet[0], TOLL_HINTS);
    const charges = toCharges(sheet.slice(1), mapping, parseDate, parseNumber).map((charge) => ({
      ...charge,
      time: charge.time.toISOString(),
    }));
    const matched = matchCharges(
      charges,
      [
        {
          deviceId: 1,
          startTime: new Date(2026, 10, 9, 8).toISOString(),
          endTime: new Date(2026, 10, 9, 9).toISOString(),
          driverUniqueId: 'd1',
        },
      ],
      [{ deviceId: 1, plate: '1234567' }],
    );
    expect(matched.map((row) => row.status)).toEqual(['matched', 'noTrip', 'unknownPlate']);
    expect(chargesByDriver(matched)).toEqual([
      { driver: 'd1', amount: 18.9 },
      { driver: 'unknown', amount: 12 },
    ]);
  });
});

describe('toll totals (saved statements)', () => {
  it('keys a charge by plate, time and amount', () => {
    expect(chargeKey({ plate: '12-345-67', time: '2026-11-02T05:10:00Z', amount: 18.4 })).toBe(
      chargeKey({ plate: '1234567', time: Date.parse('2026-11-02T05:10:00Z'), amount: '18.40' }),
    );
  });

  it('splits company and private, per driver and per cost center', () => {
    const rows = [
      { driver: 'd1', amount: 10, costCenter: 'מכירות' },
      { driver: 'd1', amount: 5.5, private: true, costCenter: 'מכירות' },
      { driver: 'd2', amount: 20, costCenter: 'שירות' },
      { amount: 3 },
    ];
    expect(chargeTotals(rows)).toEqual({
      byDriver: [
        { driver: 'd1', amount: 10, private: 5.5 },
        { driver: 'd2', amount: 20, private: 0 },
        { driver: 'unknown', amount: 3, private: 0 },
      ],
      byCostCenter: [
        { costCenter: 'שירות', amount: 20 },
        { costCenter: 'מכירות', amount: 10 },
        { costCenter: '', amount: 3 },
      ],
      company: 33,
      private: 5.5,
    });
  });
});

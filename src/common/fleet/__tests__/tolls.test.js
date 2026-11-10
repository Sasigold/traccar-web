import { describe, expect, it } from 'vitest';
import { TOLL_HINTS, chargesByDriver, matchCharges, toCharges } from '../tolls';
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

import { describe, expect, it } from 'vitest';
import { parseSims } from '../simImport';

describe('the carrier SIM list (BIZ-05)', () => {
  it('finds the columns by header and keeps valid ICCIDs once', () => {
    const { sims, skipped } = parseSims([
      ['ICCID', 'מספר טלפון', 'ספק'],
      ['8997 2010 0000 0000 001', '052-123-4567', 'Partner'],
      ['8997201000000000001', '0521234567', 'Partner'],
      ['12345', '0520000000', 'Partner'],
      ['', '', ''],
    ]);
    expect(sims).toEqual([
      { iccid: '8997201000000000001', msisdn: '0521234567', carrier: 'Partner' },
    ]);
    expect(skipped).toBe(2);
  });
});

describe('silent devices (BIZ-05)', () => {
  it('reported before, but not for more than three days', async () => {
    const { isSilent } = await import('../AdminDevicesPage');
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(isSilent({ lastUpdate: '2026-11-06T12:00:00Z' }, now)).toBe(true);
    expect(isSilent({ lastUpdate: '2026-11-09T12:00:00Z' }, now)).toBe(false);
    expect(isSilent({ lastUpdate: null }, now)).toBe(false);
    expect(isSilent({ lastUpdate: '2026-11-01T12:00:00Z', disabled: true }, now)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  collectExpiries,
  countExpiries,
  daysUntilDate,
  entityExpiryStatus,
  expiryStatus,
  faultCodes,
  vehicleExpiryFields,
  worstStatus,
} from '../fleetFields';
import { currentMaintenanceValue, maintenanceStatus, sortByUrgency } from '../maintenanceStatus';

const now = new Date(2026, 10, 6, 15, 30);

describe('expiry dates', () => {
  it('counts whole days from today, reading YYYY-MM-DD as a local date', () => {
    expect(daysUntilDate('2026-11-06', now)).toBe(0);
    expect(daysUntilDate('2026-11-07', now)).toBe(1);
    expect(daysUntilDate('2026-11-01', now)).toBe(-5);
    expect(daysUntilDate('', now)).toBeNull();
    expect(daysUntilDate('not a date', now)).toBeNull();
  });

  it('buckets by the 30 day window', () => {
    expect(expiryStatus('2026-11-05', now)).toBe('expired');
    expect(expiryStatus('2026-11-06', now)).toBe('expiring');
    expect(expiryStatus('2026-12-06', now)).toBe('expiring');
    expect(expiryStatus('2026-12-07', now)).toBe('valid');
    expect(expiryStatus(undefined, now)).toBe('none');
  });

  it('picks the most urgent status', () => {
    expect(worstStatus(['valid', 'none', 'expiring'])).toBe('expiring');
    expect(worstStatus(['expiring', 'expired'])).toBe('expired');
    expect(worstStatus([])).toBe('none');
    expect(
      entityExpiryStatus(
        { attributes: { testExpiry: '2027-05-01', leaseEndDate: '2026-11-20' } },
        vehicleExpiryFields,
        now,
      ),
    ).toBe('expiring');
  });

  it('collects vehicle and driver dates, soonest first, skipping drivers who left', () => {
    const devices = [
      {
        id: 1,
        name: 'Truck',
        attributes: {
          plateNumber: '12-345-67',
          testExpiry: '2027-01-01',
          insuranceCompulsoryExpiry: '2026-10-01',
        },
      },
      { id: 2, name: 'Van', attributes: {} },
    ];
    const drivers = [
      { id: 5, name: 'Dana', attributes: { licenseExpiry: '2026-11-20' } },
      { id: 6, name: 'Gone', attributes: { licenseExpiry: '2020-01-01', driverStatus: 'ended' } },
    ];
    const rows = collectExpiries(devices, drivers, now);
    expect(rows.map((row) => [row.entity, row.entityId, row.field, row.status])).toEqual([
      ['vehicle', 1, 'insuranceCompulsoryExpiry', 'expired'],
      ['driver', 5, 'licenseExpiry', 'expiring'],
      ['vehicle', 1, 'testExpiry', 'valid'],
    ]);
    expect(rows[0].plateNumber).toBe('12-345-67');
    expect(countExpiries(rows)).toEqual({ expired: 1, expiring: 1 });
  });
});

describe('maintenance status', () => {
  const km = (value) => value * 1000;
  const oil = { type: 'totalDistance', start: km(15000), period: km(15000) };

  it('reads the tracked value from the position or its attributes', () => {
    expect(currentMaintenanceValue('totalDistance', { attributes: { totalDistance: 5 } })).toBe(5);
    expect(currentMaintenanceValue('speed', { speed: 7, attributes: {} })).toBe(7);
    expect(currentMaintenanceValue('hours', { attributes: {} })).toBeNull();
    expect(currentMaintenanceValue('hours', null)).toBeNull();
    expect(currentMaintenanceValue('fixTime', null, 1000)).toBe(1000);
  });

  it('plans the first service at start, then start + period', () => {
    const before = maintenanceStatus(oil, { attributes: { totalDistance: km(10000) } });
    expect(before).toMatchObject({ status: 'ok', next: km(15000), remaining: km(5000) });

    const after = maintenanceStatus(oil, { attributes: { totalDistance: km(20000) } });
    expect(after).toMatchObject({ status: 'ok', next: km(30000), remaining: km(10000) });
  });

  it('flags due soon within 10% of the period, and overdue past it', () => {
    expect(maintenanceStatus(oil, { attributes: { totalDistance: km(29000) } }).status).toBe('due');
    const overdue = maintenanceStatus(oil, { attributes: { totalDistance: km(31000) } });
    expect(overdue).toMatchObject({ status: 'overdue', remaining: km(-1000) });
  });

  it('is unknown without a reading or a period', () => {
    expect(maintenanceStatus(oil, null).status).toBe('unknown');
    expect(
      maintenanceStatus({ ...oil, period: 0 }, { attributes: { totalDistance: 1 } }).status,
    ).toBe('unknown');
  });

  it('handles time based maintenance in milliseconds', () => {
    const day = 86400000;
    const yearly = { type: 'fixTime', start: Date.UTC(2026, 0, 1), period: 365 * day };
    const state = maintenanceStatus(yearly, null, Date.UTC(2026, 11, 30));
    expect(state.status).toBe('due');
    expect(Math.round(state.remaining / day)).toBe(2);
  });

  it('sorts the most urgent first', () => {
    const rows = [
      { maintenance: oil, state: { status: 'ok', remaining: km(9000) } },
      { maintenance: oil, state: { status: 'overdue', remaining: km(-10) } },
      { maintenance: oil, state: { status: 'ok', remaining: km(2000) } },
      { maintenance: oil, state: { status: 'unknown', remaining: null } },
    ];
    expect(sortByUrgency(rows).map((row) => row.state.remaining)).toEqual([
      km(-10),
      km(2000),
      km(9000),
      null,
    ]);
  });
});

describe('fault codes', () => {
  it('splits and de-duplicates dtcs and faults', () => {
    expect(faultCodes({ attributes: { dtcs: 'P0300, P0171;P0300', faults: 'U0100' } })).toEqual([
      'P0300',
      'P0171',
      'U0100',
    ]);
    expect(faultCodes({ attributes: {} })).toEqual([]);
    expect(faultCodes(null)).toEqual([]);
  });
});

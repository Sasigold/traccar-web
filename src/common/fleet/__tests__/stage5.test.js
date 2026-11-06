import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  driverNextStatuses,
  estimateEta,
  isOpenJob,
  trackingExpiry,
  whatsappLink,
  whatsappNumber,
} from '../dispatch';
import { circleArea, pairVisits, visitTotals } from '../visits';
import { batteryReading, readingState, sensorRows, temperatureReadings } from '../sensors';
import { generateApiKey, isValidWebhookUrl, keyState, sha256Hex } from '../integrations';

const telAviv = { latitude: 32.0853, longitude: 34.7818 };
const jerusalem = { latitude: 31.7683, longitude: 35.2137 };

describe('dispatch', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm(telAviv, jerusalem)).toBeGreaterThan(53);
    expect(distanceKm(telAviv, jerusalem)).toBeLessThan(55);
  });

  it('estimates ETA from speed, or a city average when slow', () => {
    const moving = estimateEta({ ...telAviv, speed: 80 / 1.852 }, jerusalem);
    expect(moving.km).toBeCloseTo(70.4, 0);
    expect(moving.minutes).toBe(53);
    const stopped = estimateEta({ ...telAviv, speed: 0 }, jerusalem);
    expect(stopped.minutes).toBe(105);
    expect(estimateEta(telAviv, telAviv)).toEqual({ km: 0, minutes: 0 });
    expect(estimateEta(null, jerusalem)).toBeNull();
    expect(estimateEta(telAviv, { latitude: null, longitude: null })).toBeNull();
  });

  it('lets a driver move a job forward only', () => {
    expect(driverNextStatuses('assigned')).toEqual(['en_route']);
    expect(driverNextStatuses('arrived')).toEqual(['done', 'failed']);
    expect(driverNextStatuses('done')).toEqual([]);
    expect(isOpenJob('en_route')).toBe(true);
    expect(isOpenJob('cancelled')).toBe(false);
  });

  it('expires tracking links after the delivery window', () => {
    const now = new Date('2026-11-06T08:00:00Z');
    expect(trackingExpiry({ window_end: '2026-11-06T12:00:00Z' }, now).toISOString()).toBe(
      '2026-11-06T13:00:00.000Z',
    );
    expect(trackingExpiry({ window_end: '2026-11-06T07:00:00Z' }, now).toISOString()).toBe(
      '2026-11-06T12:00:00.000Z',
    );
    expect(trackingExpiry({}, now).toISOString()).toBe('2026-11-06T12:00:00.000Z');
  });

  it('builds WhatsApp links for Israeli numbers', () => {
    expect(whatsappNumber('050-123-4567')).toBe('972501234567');
    expect(whatsappNumber('+972 50 1234567')).toBe('972501234567');
    expect(whatsappNumber('')).toBeNull();
    expect(whatsappLink('0501234567', 'שלום')).toBe(
      `https://wa.me/972501234567?text=${encodeURIComponent('שלום')}`,
    );
    expect(whatsappLink(null, 'x')).toBe('https://wa.me/?text=x');
  });
});

describe('visits', () => {
  const event = (type, deviceId, geofenceId, eventTime) => ({
    type,
    deviceId,
    geofenceId,
    eventTime,
  });

  it('pairs enter and exit events per vehicle and point', () => {
    const visits = pairVisits(
      [
        event('geofenceExit', 1, 7, '2026-11-06T09:30:00Z'),
        event('geofenceEnter', 1, 7, '2026-11-06T09:00:00Z'),
        event('geofenceEnter', 2, 7, '2026-11-06T09:10:00Z'),
        event('geofenceExit', 2, 8, '2026-11-06T08:00:00Z'),
        event('geofenceEnter', 1, 9, '2026-11-06T10:00:00Z'),
      ],
      new Date('2026-11-06T10:20:00Z'),
    );
    expect(visits).toEqual([
      { deviceId: 1, geofenceId: 9, arrived: '2026-11-06T10:00:00Z', left: null, minutes: 20 },
      { deviceId: 2, geofenceId: 7, arrived: '2026-11-06T09:10:00Z', left: null, minutes: 70 },
      {
        deviceId: 1,
        geofenceId: 7,
        arrived: '2026-11-06T09:00:00Z',
        left: '2026-11-06T09:30:00Z',
        minutes: 30,
      },
      { deviceId: 2, geofenceId: 8, arrived: null, left: '2026-11-06T08:00:00Z', minutes: null },
    ]);
    const totals = visitTotals(visits);
    expect(totals.get(7)).toEqual({ count: 2, minutes: 100 });
    expect(totals.get(8)).toEqual({ count: 1, minutes: 0 });
  });

  it('writes a Traccar circle', () => {
    expect(circleArea('32.1', 34.8, 99.6)).toBe('CIRCLE (32.1 34.8, 100)');
  });
});

describe('sensors', () => {
  it('reads temperatures and battery from attributes', () => {
    expect(
      temperatureReadings({ temp10: 3, temp2: '-18.5', deviceTemp: 40, temp1: 'x', temp: 4 }),
    ).toEqual([
      { key: 'temp', value: 4 },
      { key: 'temp2', value: -18.5 },
      { key: 'temp10', value: 3 },
    ]);
    expect(batteryReading({ batteryLevel: 54 })).toBe(54);
    expect(batteryReading({})).toBeNull();
  });

  it('checks readings against limits', () => {
    expect(readingState(5, 2, 8)).toBe('ok');
    expect(readingState(9, 2, 8)).toBe('high');
    expect(readingState(-1, 2, null)).toBe('low');
    expect(readingState(null, 2, 8)).toBe('none');
    expect(readingState(0, '', '')).toBe('ok');
  });

  it('lists vehicles with sensors, alerts first', () => {
    const devices = { 1: { id: 1, name: 'B' }, 2: { id: 2, name: 'A' }, 3: { id: 3, name: 'C' } };
    const positions = {
      1: { attributes: { temp1: 9 } },
      2: { attributes: { batteryLevel: 80, charge: true } },
      3: { attributes: { speed: 1 } },
    };
    const rows = sensorRows(devices, positions, { 1: { temp_min: 2, temp_max: 8 } });
    expect(rows.map((row) => row.device.name)).toEqual(['B', 'A']);
    expect(rows[0].alert).toBe(true);
    expect(rows[0].temperatures[0].state).toBe('high');
    expect(rows[1].charging).toBe(true);
  });
});

describe('integrations', () => {
  it('generates keys with a visible prefix', () => {
    const { key, prefix } = generateApiKey((bytes) => bytes.fill(171));
    expect(key).toBe(`vf_${'ab'.repeat(20)}`);
    expect(prefix).toBe('vf_ababa');
  });

  it('hashes keys like the database (sha256 hex)', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('accepts only https webhooks', () => {
    expect(isValidWebhookUrl('https://example.com/hook')).toBe(true);
    expect(isValidWebhookUrl('http://example.com/hook')).toBe(false);
    expect(isValidWebhookUrl('nope')).toBe(false);
  });

  it('tells key state', () => {
    const now = new Date('2026-11-06T00:00:00Z');
    expect(keyState({}, now)).toBe('active');
    expect(keyState({ revoked_at: '2026-01-01' }, now)).toBe('revoked');
    expect(keyState({ expires_at: '2026-11-01' }, now)).toBe('expired');
  });
});

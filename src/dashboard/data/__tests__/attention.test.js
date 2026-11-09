import { describe, expect, it } from 'vitest';
import { SILENT_HOURS, attentionCounts, attentionItems } from '../attention';

const NOW = Date.parse('2026-11-09T09:00:00Z');
const HOUR = 3600000;

describe('attentionItems', () => {
  it('ranks by level, then by how late', () => {
    const items = attentionItems(
      {
        expiries: [
          { id: 'a', entity: 'vehicle', entityId: 1, status: 'expired', days: -3, labelKey: 'x' },
          { id: 'b', entity: 'vehicle', entityId: 2, status: 'expired', days: -40, labelKey: 'x' },
          { id: 'c', entity: 'driver', entityId: 7, status: 'expiring', days: 10, labelKey: 'x' },
          { id: 'd', entity: 'vehicle', entityId: 3, status: 'valid', days: 200, labelKey: 'x' },
        ],
        maintenance: [
          { deviceId: 4, maintenance: { id: 9, name: 'Oil' }, maintenanceStatus: 'overdue' },
          { deviceId: 5, maintenance: { id: 9, name: 'Oil' }, maintenanceStatus: 'ok' },
        ],
      },
      NOW,
    );
    expect(items.map((item) => item.key)).toEqual([
      'expiry-b',
      'expiry-a',
      'maintenance-4-9',
      'expiry-c',
    ]);
    expect(items[0]).toMatchObject({
      level: 'critical',
      deviceId: 2,
      path: '/fleet/vehicle/2?tab=documents',
    });
    expect(items[3]).toMatchObject({ level: 'medium', deviceId: null, path: '/fleet/expiries' });
  });

  it('keeps open incidents only, by severity', () => {
    const items = attentionItems(
      {
        incidents: [
          { id: 1, status: 'reported', severity: 'severe', occurred_at: '2026-11-07T09:00:00Z' },
          { id: 2, status: 'closed', severity: 'severe', occurred_at: '2026-11-07T09:00:00Z' },
          { id: 3, status: 'in_repair', severity: 'minor', occurred_at: '2026-11-01T09:00:00Z' },
        ],
      },
      NOW,
    );
    expect(items.map((item) => [item.key, item.level, item.days])).toEqual([
      ['incident-1', 'high', -2],
      ['incident-3', 'medium', -8],
    ]);
    expect(items[0].path).toBe('/fleet/incident/1');
  });

  it('flags vehicles that stopped reporting, not those that never did', () => {
    const items = attentionItems(
      {
        live: [
          { deviceId: 1, status: 'offline', lastUpdate: NOW - (SILENT_HOURS - 1) * HOUR },
          { deviceId: 2, status: 'offline', lastUpdate: NOW - 30 * HOUR },
          { deviceId: 3, status: 'unknown', lastUpdate: NOW - 100 * HOUR },
          { deviceId: 4, status: 'online', lastUpdate: NOW - 100 * HOUR },
          { deviceId: 5, status: 'offline', lastUpdate: null },
        ],
      },
      NOW,
    );
    expect(items.map((item) => [item.deviceId, item.level, item.hours])).toEqual([
      [3, 'high', 100],
      [2, 'medium', 30],
    ]);
  });

  it('lists tickets close to their transfer deadline', () => {
    const items = attentionItems(
      {
        violations: [
          { id: 1, status: 'open', due_at: '2026-11-01', drivers: { full_name: 'Dana' } },
          { id: 2, status: 'open', due_at: '2026-11-15', vehicles: { plate_number: '12-345-67' } },
          { id: 3, status: 'open', due_at: '2027-01-15' },
          { id: 4, status: 'transferred', due_at: '2026-11-01' },
        ],
      },
      NOW,
    );
    expect(items.map((item) => [item.key, item.level, item.name, item.days])).toEqual([
      ['violation-1', 'critical', 'Dana', -8],
      ['violation-2', 'high', '12-345-67', 6],
    ]);
  });

  it('counts per level', () => {
    expect(
      attentionCounts([{ level: 'critical' }, { level: 'medium' }, { level: 'medium' }]),
    ).toEqual({ critical: 1, high: 0, medium: 2 });
  });
});

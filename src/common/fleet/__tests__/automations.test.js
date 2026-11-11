import { describe, expect, it } from 'vitest';
import { backtest, inNight, matches, sentence } from '../automations';

// AI-05: rules from templates, as sentences, tested on the last week.
const local = (h, m = 0) => new Date(2026, 10, 9, h, m).toISOString();

describe('automation rules', () => {
  it('"after hours" crosses midnight', () => {
    expect(inNight(local(21), '20:00', '06:00')).toBe(true);
    expect(inNight(local(3), '20:00', '06:00')).toBe(true);
    expect(inNight(local(12), '20:00', '06:00')).toBe(false);
  });

  it('match their own kind of row', () => {
    expect(
      matches(
        { template: 'overspeed', params: { speed: 110 } },
        { type: 'deviceOverspeed', attributes: { speed: 65 } },
      ),
    ).toBe(true);
    expect(
      matches(
        { template: 'overspeed', params: { speed: 130 } },
        { type: 'deviceOverspeed', attributes: { speed: 65 } },
      ),
    ).toBe(false);
    expect(
      matches(
        { template: 'geofenceEnter', params: { geofenceId: 3 } },
        { type: 'geofenceEnter', geofenceId: 3 },
      ),
    ).toBe(true);
    expect(
      matches(
        { template: 'geofenceEnter', params: { geofenceId: 3 } },
        { type: 'geofenceEnter', geofenceId: 4 },
      ),
    ).toBe(false);
    expect(
      matches(
        { template: 'criticalFault', params: {} },
        { type: 'alarm', attributes: { alarm: 'tow' } },
      ),
    ).toBe(true);
    expect(
      matches({ template: 'idling', params: { minutes: 15 } }, { engineHours: 20 * 60000 }),
    ).toBe(true);
  });

  it("the week's test lists what would have fired, newest first", () => {
    const rule = { template: 'afterHours', params: { after: '20:00', before: '06:00' } };
    const rows = [{ startTime: local(21) }, { startTime: local(10) }, { startTime: local(23) }];
    expect(backtest(rule, rows).map((row) => row.startTime)).toEqual([local(23), local(21)]);
  });

  it('reads as a sentence', () => {
    expect(sentence({ template: 'idling', params: { minutes: 20 } })).toEqual({
      key: 'autoSentenceIdling',
      values: [20],
    });
    expect(
      sentence(
        { template: 'geofenceEnter', params: { geofenceId: 3 } },
        { geofence: () => 'מחסן' },
      ),
    ).toEqual({ key: 'autoSentenceGeofence', values: ['מחסן'] });
  });
});

describe('run keys (AI-05)', () => {
  it('use the event id, or a negative key for a trip or stop', async () => {
    const { runKey } = await import('../automations');
    expect(runKey({ id: 77, eventTime: '2026-11-10T06:00:00Z', deviceId: 1 })).toBe(77);
    const key = runKey({ deviceId: 3, startTime: '2026-11-10T06:00:00Z' });
    expect(key).toBeLessThan(0);
    expect(key).toBe(runKey({ deviceId: 3, startTime: '2026-11-10T06:00:00Z' }));
    expect(key).not.toBe(runKey({ deviceId: 4, startTime: '2026-11-10T06:00:00Z' }));
  });
});

describe('the Shabbat and holiday rule (ISR-09)', () => {
  const rule = { template: 'restDay', params: {} };
  it('fires for a trip on Shabbat, not on a weekday', () => {
    expect(matches(rule, { startTime: '2026-11-14T09:00:00Z' })).toBe(true);
    expect(matches(rule, { startTime: '2026-11-12T09:00:00Z' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { caseRow, responseStats, slaState } from '../alertCases';

// LIV-24: the countdown on a new alert, and the response-time report.
const now = Date.parse('2026-11-09T10:00:00Z');
const ago = (minutes) => new Date(now - minutes * 60000).toISOString();

describe('the response countdown', () => {
  it('counts down to the target, then counts the delay', () => {
    expect(slaState(ago(3), 'new', 15, now)).toEqual({ kind: 'due', minutes: 12 });
    expect(slaState(ago(20), 'new', 15, now)).toEqual({ kind: 'late', minutes: 5 });
  });

  it('stops once someone took the alert', () => {
    expect(slaState(ago(20), 'in_progress', 15, now).kind).toBe('handled');
    expect(slaState(ago(20), 'closed', 15, now).kind).toBe('handled');
  });
});

describe('the response-time report', () => {
  const cases = [
    { occurred_at: ago(60), taken_at: ago(55), taken_by: 'a', status: 'closed' },
    { occurred_at: ago(60), taken_at: ago(30), taken_by: 'a', status: 'closed' },
    { occurred_at: ago(60), taken_at: ago(50), taken_by: 'b', status: 'in_progress' },
    { occurred_at: ago(10), taken_at: null, taken_by: null, status: 'new' },
  ];

  it('sums up counts, the median and the share within the target', () => {
    const stats = responseStats(cases, 15);
    expect(stats).toMatchObject({ total: 4, taken: 3, open: 2, medianMinutes: 10 });
    expect(stats.withinSla).toBeCloseTo(2 / 3);
  });

  it('per person, busiest first', () => {
    const { people } = responseStats(cases, 15);
    expect(people).toEqual([
      { id: 'a', count: 2, medianMinutes: 17.5, withinSla: 0.5 },
      { id: 'b', count: 1, medianMinutes: 10, withinSla: 1 },
    ]);
  });

  it('is empty without cases', () => {
    expect(responseStats([], 15)).toMatchObject({ total: 0, medianMinutes: null, withinSla: null });
  });
});

describe('the case row', () => {
  it('records the alert and the chosen status', () => {
    const event = { id: 77, deviceId: 3, type: 'alarm', eventTime: ago(1) };
    expect(caseRow(event, 'o1', 'in_progress', 'p1')).toEqual({
      org_id: 'o1',
      traccar_event_id: 77,
      traccar_device_id: 3,
      event_type: 'alarm',
      occurred_at: ago(1),
      status: 'in_progress',
      assigned_to: 'p1',
    });
  });
});

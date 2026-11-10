import { describe, expect, it } from 'vitest';
import { delta, formatDelta, previousRange } from '../compare';
import { addSavedReport, reportOptions, savedReportLink, savedReportView } from '../savedReports';

// REP-09: comparing with the period before, and saved report views.
describe('the previous period', () => {
  it('has the same length and ends right before', () => {
    const range = previousRange('2026-11-02T00:00:00.000Z', '2026-11-08T23:59:59.999Z');
    expect(range).toEqual({ from: '2026-10-26T00:00:00.000Z', to: '2026-11-01T23:59:59.999Z' });
  });

  it('gives the change in percent', () => {
    expect(delta(120, 100)).toEqual({ direction: 'up', percent: 20 });
    expect(delta(75, 100)).toEqual({ direction: 'down', percent: 25 });
    expect(delta(100, 100)).toEqual({ direction: 'same', percent: 0 });
    expect(delta(5, 0)).toBeNull();
    expect(delta(5, undefined)).toBeNull();
    expect(formatDelta(delta(120, 100))).toBe('▲ 20%');
    expect(formatDelta(null)).toBe('');
  });
});

describe('saved report views', () => {
  it('keep the period as a preset and open on the current dates', () => {
    const view = savedReportView({
      name: ' צפון · שבוע שעבר ',
      path: '/reports/trips',
      deviceIds: ['all', '3'],
      groupIds: ['2'],
      period: 'lastWeek',
    });
    expect(view).toMatchObject({ name: 'צפון · שבוע שעבר', deviceIds: [3], groupIds: [2] });
    const link = new URL(savedReportLink(view, new Date('2026-11-11T10:00:00')), 'http://x');
    expect(link.pathname).toBe('/reports/trips');
    expect(link.searchParams.getAll('deviceId')).toEqual(['3']);
    expect(link.searchParams.get('period')).toBe('lastWeek');
    expect(Date.parse(link.searchParams.get('to'))).toBeLessThan(Date.parse('2026-11-11T10:00:00'));
  });

  it('replace a view saved under the same name, newest first', () => {
    const a = { id: 'a', name: 'א' };
    const b = { id: 'b', name: 'ב' };
    expect(addSavedReport([a, b], { id: 'c', name: 'ב' }).map((view) => view.id)).toEqual([
      'c',
      'a',
    ]);
  });
});

describe('a saved view keeps the report options and columns (REP-09)', () => {
  it('stores the options apart from the period and vehicles, and puts them back', () => {
    const options = reportOptions('deviceId=1&from=a&to=b&period=today&daily=true&view=geofence');
    expect(options).toEqual([
      ['daily', 'true'],
      ['view', 'geofence'],
    ]);
    const view = savedReportView({
      name: 'יומי',
      path: '/reports/summary',
      deviceIds: [1],
      period: 'today',
      options,
      columns: ['distance', 'activeDays'],
    });
    const link = new URL(savedReportLink(view, new Date('2026-11-10T10:00:00Z')), 'http://x');
    expect(link.searchParams.get('daily')).toBe('true');
    expect(link.searchParams.get('view')).toBe('geofence');
    expect(link.searchParams.get('columns')).toBe('distance,activeDays');
  });
});

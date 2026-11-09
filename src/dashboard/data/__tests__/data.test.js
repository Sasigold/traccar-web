import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';
import { OTHER, aggregate, delta, reduceMeasure } from '../aggregate';
import { assignSlots } from '../colors';
import { DATASETS, DIMENSIONS, liveRow, resolveQuery, sourceOf } from '../datasets';
import { formatDelta, formatNumber, toDisplay } from '../format';
import { bucketFor, periodRange, previousRange, shiftRange, timeBuckets } from '../periods';
import { createQueryCache } from '../queryCache';
import { TooLargeError, checkSize, chunk, fetchReport, reportUrl } from '../reportFetch';
import { scopeDeviceIds, scopeKey } from '../scope';

const now = dayjs('2026-11-08T10:30:00');

describe('periods', () => {
  it('builds preset ranges', () => {
    expect(periodRange('today', now).from.format('YYYY-MM-DD HH:mm')).toBe('2026-11-08 00:00');
    expect(periodRange('yesterday', now).to.format('YYYY-MM-DD HH:mm')).toBe('2026-11-07 23:59');
    expect(periodRange('last7', now).from.format('YYYY-MM-DD')).toBe('2026-11-02');
    expect(periodRange('lastMonth', now).from.format('YYYY-MM-DD')).toBe('2026-10-01');
    expect(periodRange('custom', now, { from: 'x' }).from.format('YYYY-MM-DD')).toBe('2026-11-08');
  });

  it('compares with the same elapsed time one period back', () => {
    const range = periodRange('thisMonth', now);
    const previous = previousRange('thisMonth', range, now);
    expect(previous.from.format('YYYY-MM-DD')).toBe('2026-10-01');
    expect(previous.to.format('YYYY-MM-DD HH:mm')).toBe('2026-10-08 10:30');
  });

  it('chooses hours for a day and days for a month', () => {
    expect(bucketFor(periodRange('today', now))).toBe('hour');
    expect(bucketFor(periodRange('last30', now))).toBe('day');
  });

  it('flags future and running buckets', () => {
    const buckets = timeBuckets(periodRange('today', now), 'hour', now);
    expect(buckets).toHaveLength(24);
    expect(buckets[10].partial).toBe(true);
    expect(buckets[11].future).toBe(true);
    expect(buckets[9].future).toBe(false);
  });
});

describe('scope', () => {
  const devices = { 1: { id: 1, groupId: 1 }, 2: { id: 2, groupId: 3 }, 3: { id: 3, groupId: 0 } };
  const groups = { 1: { id: 1 }, 3: { id: 3, groupId: 1 } };

  it('includes subgroups', () => {
    expect(scopeDeviceIds(devices, groups, [1])).toEqual([1, 2]);
    expect(scopeDeviceIds(devices, groups, [])).toEqual([1, 2, 3]);
  });

  it('gives a short stable key', () => {
    expect(scopeKey([1, 2, 3])).toBe(scopeKey([1, 2, 3]));
    expect(scopeKey([1, 2, 3])).not.toBe(scopeKey([1, 2, 4]));
  });
});

describe('live rows', () => {
  const nowMs = Date.parse('2026-11-08T10:30:00Z');
  const device = { id: 1, status: 'online', groupId: 2, lastUpdate: '2026-11-08T10:29:00Z' };

  it('classifies motion', () => {
    expect(liveRow(device, { speed: 30, attributes: {} }, nowMs).motion).toBe('moving');
    expect(liveRow(device, { speed: 0, attributes: { ignition: true } }, nowMs).motion).toBe(
      'idle',
    );
    expect(liveRow(device, { speed: 0, attributes: {} }, nowMs).motion).toBe('parked');
    expect(liveRow({ ...device, status: 'offline' }, { speed: 30 }, nowMs).motion).toBe('offline');
  });

  it('bands speed in the user unit and reports age', () => {
    const row = liveRow(device, { speed: 40, attributes: {} }, nowMs, 'kmh');
    expect(row.speedBand).toBe('s2');
    expect(row.lastReport).toBe('live');
    expect(liveRow({ ...device, lastUpdate: null }, null, nowMs).lastReport).toBe('never');
  });
});

describe('aggregate', () => {
  const rows = [
    { deviceId: 1, distance: 100, status: 'online', type: 'alarm', attributes: { alarm: 'sos' } },
    { deviceId: 1, distance: 50, status: 'online', type: 'deviceOverspeed' },
    { deviceId: 2, distance: 300, status: 'offline', type: 'deviceOverspeed' },
    { deviceId: 3, distance: 0, status: 'unknown', type: 'ignitionOn' },
    { deviceId: 4, distance: 20, status: 'online', type: 'ignitionOn' },
  ];
  const sum = DATASETS.summary.measures.distance;

  it('reduces measures', () => {
    expect(reduceMeasure(rows, sum)).toBe(470);
    expect(reduceMeasure(rows, DATASETS.summary.measures.activeVehicles)).toBe(3);
    expect(reduceMeasure(rows, DATASETS.live.measures.availability)).toBe(60);
    expect(reduceMeasure([], DATASETS.summary.measures.maxSpeed)).toBeNull();
  });

  it('groups by a category, ranks, and folds the tail into Other', () => {
    const model = aggregate(rows, {
      dimension: DIMENSIONS.vehicle,
      measure: sum,
      topN: 3,
      sort: 'desc',
    });
    expect(model.items.map((item) => item.key)).toEqual([2, 1, OTHER]);
    expect(model.items[2].value).toBe(20);
    expect(model.items[2].keys).toEqual([4, 3]);
    expect(model.total).toBe(470);
  });

  it('keeps the natural order of status dimensions', () => {
    const model = aggregate(rows, {
      dimension: DIMENSIONS.status,
      measure: DATASETS.live.measures.vehicles,
      sort: 'desc',
    });
    expect(model.items.map((item) => [item.key, item.value])).toEqual([
      ['online', 3],
      ['offline', 1],
      ['unknown', 1],
    ]);
  });

  it('folds alarms by alarm type', () => {
    const model = aggregate(rows, {
      dimension: DIMENSIONS.eventType,
      measure: DATASETS.events.measures.events,
    });
    expect(model.items.find((item) => item.key === 'alarm:sos').value).toBe(1);
  });

  it('fills time buckets and leaves the future empty', () => {
    const range = periodRange('today', now);
    const buckets = timeBuckets(range, 'hour', now);
    const trips = [
      { startTime: '2026-11-08T08:10:00', distance: 1000 },
      { startTime: '2026-11-08T08:40:00', distance: 500 },
      { startTime: '2026-11-08T09:05:00', distance: 200 },
    ];
    const model = aggregate(
      trips,
      { dimension: DIMENSIONS.time, measure: sum, buckets, bucket: 'hour' },
      { timeOf: (row) => dayjs(row.startTime).valueOf() },
    );
    expect(model.kind).toBe('timeseries');
    expect(model.points[8].value).toBe(1500);
    expect(model.points[7].value).toBe(0);
    expect(model.points[20].value).toBeNull();
  });

  it('splits a time series into the largest series plus Other', () => {
    const range = periodRange('today', now);
    const events = ['a', 'a', 'b', 'c', 'd', 'e'].map((type) => ({
      type,
      eventTime: '2026-11-08T09:00:00',
    }));
    const model = aggregate(
      events,
      {
        dimension: DIMENSIONS.time,
        breakdown: DIMENSIONS.eventType,
        measure: DATASETS.events.measures.events,
        buckets: timeBuckets(range, 'hour', now),
        bucket: 'hour',
      },
      { timeOf: (row) => dayjs(row.eventTime).valueOf() },
    );
    expect(model.series).toEqual(['a', 'b', 'c', OTHER]);
    expect(model.points[9].values).toEqual({ a: 2, b: 1, c: 1, [OTHER]: 2 });
  });

  it('computes deltas', () => {
    expect(delta(120, 100)).toBe(20);
    expect(delta(5, 0)).toBeNull();
  });
});

describe('queries and sources', () => {
  it('fills in a broken query', () => {
    expect(resolveQuery({ ds: 'nope', m: 'x', n: 99 })).toMatchObject({
      ds: 'live',
      m: 'vehicles',
      d: null,
      n: 20,
    });
    expect(resolveQuery({ ds: 'events', d: 'time', b: 'time' }).b).toBeNull();
  });

  it('uses daily summaries for days and trips for hours', () => {
    expect(sourceOf('summary', { timeAxis: true, bucket: 'day' })).toMatchObject({
      key: 'summaryDaily',
      params: { daily: true },
    });
    expect(sourceOf('summary', { timeAxis: true, bucket: 'hour' }).key).toBe('trips');
    expect(sourceOf('summary').key).toBe('summary');
  });
});

describe('colors', () => {
  it('keeps slots stable when values reorder and never assigns Other', () => {
    const first = assignSlots(['a', 'b', 'c']);
    expect(first).toEqual({ a: 0, b: 1, c: 2 });
    expect(assignSlots(['c', 'a', 'd', OTHER], first)).toEqual({ c: 2, a: 0, d: 1 });
  });
});

describe('format', () => {
  it('converts to the user units', () => {
    expect(toDisplay(10000, 'distance', { distanceUnit: 'km' })).toBe(10);
    expect(toDisplay(10, 'speed', { speedUnit: 'kmh' })).toBeCloseTo(18.52);
    expect(toDisplay(5400000, 'duration')).toBe(1.5);
  });

  it('compacts large numbers only', () => {
    expect(formatNumber(1284, 'count')).toBe('1,284');
    expect(formatNumber(12900, 'count')).toBe('12.9K');
    expect(formatNumber(4.25, 'distance')).toBe('4.3');
    expect(formatNumber(null)).toBe('—');
    expect(formatDelta(12.345)).toBe('+12%');
    expect(formatDelta(-3.21)).toBe('−3.2%');
  });
});

describe('report requests', () => {
  it('chunks ids and builds urls', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(
      reportUrl('events', { from: 'a', to: 'b', deviceIds: [1, 2], params: { type: ['x', 'y'] } }),
    ).toBe('api/reports/events?from=a&to=b&deviceId=1&deviceId=2&type=x&type=y');
  });

  it('refuses requests that are too large', () => {
    expect(() => checkSize('events', 100, 30)).toThrow(TooLargeError);
    expect(() => checkSize('summary', 100, 30)).not.toThrow();
  });

  it('fetches every chunk and merges the rows', async () => {
    const fetchJson = vi.fn(async (url) => [{ url }]);
    const ids = Array.from({ length: 250 }, (_, index) => index + 1);
    const rows = await fetchReport({
      endpoint: 'summary',
      from: 'a',
      to: 'b',
      deviceIds: ids,
      fetchJson,
    });
    expect(fetchJson).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(3);
  });
});

describe('query cache', () => {
  it('shares one request between subscribers and keeps data while reloading', async () => {
    let time = 0;
    const cache = createQueryCache({ now: () => time });
    const loader = vi.fn(async () => 'data');
    const stop = cache.subscribe('k', () => {});
    cache.ensure('k', loader);
    cache.ensure('k', loader);
    await vi.waitFor(() => expect(cache.get('k').status).toBe('success'));
    expect(loader).toHaveBeenCalledTimes(1);
    time = 1000;
    cache.ensure('k', async () => 'new', { maxAge: 500 });
    expect(cache.get('k')).toMatchObject({ status: 'loading', stale: true, data: 'data' });
    await vi.waitFor(() => expect(cache.get('k').data).toBe('new'));
    stop();
  });

  it('aborts a request nobody waits for', async () => {
    const cache = createQueryCache();
    let aborted = false;
    const stop = cache.subscribe('k', () => {});
    cache.ensure(
      'k',
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );
    await Promise.resolve();
    stop();
    expect(aborted).toBe(true);
    expect(cache.get('k').status).toBe('idle');
  });
});

describe('period arrows keep calendar periods whole', () => {
  it('moves a month to the whole next month', () => {
    const range = periodRange('thisMonth', dayjs('2026-02-10T12:00:00'));
    const next = shiftRange('thisMonth', range, 1);
    expect(next.from.format('YYYY-MM-DD')).toBe('2026-03-01');
    expect(next.to.format('YYYY-MM-DD')).toBe('2026-03-31');
    const previous = shiftRange('thisMonth', range, -1);
    expect(previous.to.format('YYYY-MM-DD')).toBe('2026-01-31');
  });

  it('moves rolling periods by their length', () => {
    const range = periodRange('last7', dayjs('2026-11-09T12:00:00'));
    const previous = shiftRange('last7', range, -1);
    expect(previous.from.format('YYYY-MM-DD')).toBe('2026-10-27');
  });
});

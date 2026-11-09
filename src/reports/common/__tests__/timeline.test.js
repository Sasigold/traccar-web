import { describe, expect, it } from 'vitest';
import { buildTimeline, timelineTotals, vehicleTimeline } from '../timeline';

const at = (hhmm) => `2026-11-10T${hhmm}:00Z`;
const from = Date.parse(at('00:00'));
const to = Date.parse('2026-11-11T00:00:00Z');
const MIN = 60000;
const later = to + 1;

describe('daily timeline', () => {
  const trips = [
    { deviceId: 1, startTime: at('08:00'), endTime: at('08:30') },
    { deviceId: 1, startTime: at('12:00'), endTime: at('12:45') },
  ];
  const stops = [
    // Engine on for 10 of the 210 minutes standing.
    { deviceId: 1, startTime: at('08:30'), endTime: at('12:00'), engineHours: 10 * MIN },
  ];

  it('draws driving, idling at the start of a stop, parking and gaps', () => {
    const segments = vehicleTimeline(trips, stops, from, to, later);
    expect(segments.map((s) => [s.type, (s.end - s.start) / MIN])).toEqual([
      ['nodata', 480],
      ['driving', 30],
      ['idle', 10],
      ['parked', 200],
      ['driving', 45],
      ['nodata', (to - Date.parse(at('12:45'))) / MIN],
    ]);
  });

  it('clips rows that cross midnight', () => {
    const night = [{ deviceId: 1, startTime: '2026-11-09T23:30:00Z', endTime: at('00:20') }];
    const [first] = vehicleTimeline(night, [], from, to);
    expect(first).toMatchObject({ type: 'driving', start: from, end: Date.parse(at('00:20')) });
  });

  it('totals the day and orders vehicles by driving', () => {
    const totals = timelineTotals(vehicleTimeline(trips, stops, from, to, later));
    expect(totals).toMatchObject({
      driving: 75 * MIN,
      idle: 10 * MIN,
      parked: 200 * MIN,
      trips: 2,
    });
    expect(totals.firstStart).toBe(Date.parse(at('08:00')));
    const rows = buildTimeline(
      [
        { id: 2, name: 'Quiet' },
        { id: 1, name: 'Busy' },
      ],
      trips,
      stops,
      from,
      to,
      later,
    );
    expect(rows.map((row) => row.device.name)).toEqual(['Busy', 'Quiet']);
    expect(rows[1].segments).toEqual([]);
  });
});

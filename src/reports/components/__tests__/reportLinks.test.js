import { describe, expect, it } from 'vitest';
import { replayLink, stopReplayLink, summaryTripsLink, tripsLink } from '../reportLinks';

const params = (url) => Object.fromEntries(new URLSearchParams(url.split('?')[1]));

describe('report links (REP-07)', () => {
  it('keeps the vehicle and the period', () => {
    expect(tripsLink(7, '2026-11-01T00:00:00Z', '2026-11-07T23:59:59Z')).toBe(
      '/reports/trips?deviceId=7&from=2026-11-01T00%3A00%3A00.000Z&to=2026-11-07T23%3A59%3A59.000Z',
    );
    expect(replayLink(7, '2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z')).toMatch(
      /^\/replay\?deviceId=7&/,
    );
  });

  it('replays a stop from ten minutes before to ten minutes after', () => {
    const query = params(
      stopReplayLink({
        deviceId: 3,
        startTime: '2026-11-05T10:00:00Z',
        endTime: '2026-11-05T10:30:00Z',
      }),
    );
    expect(query).toEqual({
      deviceId: '3',
      from: '2026-11-05T09:50:00.000Z',
      to: '2026-11-05T10:40:00.000Z',
    });
  });

  it('opens the trips of a summary row: its day, or its period', () => {
    const item = {
      deviceId: 2,
      startTime: '2026-11-05T05:00:00Z',
      endTime: '2026-11-05T18:00:00Z',
    };
    expect(params(summaryTripsLink(item, false))).toMatchObject({
      from: '2026-11-05T05:00:00.000Z',
      to: '2026-11-05T18:00:00.000Z',
    });
    const daily = params(summaryTripsLink(item, true));
    expect(Date.parse(daily.to) - Date.parse(daily.from)).toBe(24 * 3600 * 1000 - 1);
  });
});

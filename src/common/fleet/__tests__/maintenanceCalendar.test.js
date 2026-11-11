import { describe, expect, it } from 'vitest';
import { calendarEntries, dailyRates, dayKey, expectedServiceDate } from '../maintenanceCalendar';

const DAY = 86400000;
const now = new Date(2026, 10, 11, 9).getTime();

const row = (deviceId, type, state) => ({
  key: `${deviceId}-${type}`,
  deviceId,
  maintenance: { id: 1, type, name: type },
  state,
});

describe('dailyRates', () => {
  it('divides the period by its days', () => {
    expect(dailyRates([{ deviceId: 3, distance: 3000000, engineHours: 30 * 3600000 }], 30)).toEqual(
      { 3: { distance: 100000, hours: 3600000 } },
    );
  });

  it('is empty without days', () => {
    expect(dailyRates([{ deviceId: 3, distance: 10 }], 0)).toEqual({});
  });
});

describe('expectedServiceDate', () => {
  const rates = { 1: { distance: 100000, hours: 3600000 } };

  it('keeps the date of a plan by date', () => {
    const next = now + 5 * DAY;
    expect(expectedServiceDate(row(1, 'fixTime', { next, remaining: 5 * DAY }), rates, now)).toBe(
      next,
    );
  });

  it('forecasts a plan by distance from the daily pace', () => {
    // 1,000 km left at 100 km a day: ten days.
    const result = expectedServiceDate(
      row(1, 'totalDistance', { next: 2e7, remaining: 1e6 }),
      rates,
      now,
    );
    expect(result).toBe(now + 10 * DAY);
  });

  it('forecasts engine hours and rounds up to whole days', () => {
    const result = expectedServiceDate(
      row(1, 'hours', { next: 1, remaining: 24.5 * 3600000 }),
      rates,
      now,
    );
    // 24.5 engine hours left at one hour a day: 25 days.
    expect(result).toBe(now + 25 * DAY);
  });

  it('puts an overdue plan on today', () => {
    expect(expectedServiceDate(row(1, 'odometer', { next: 1, remaining: -5 }), rates, now)).toBe(
      now,
    );
    expect(
      expectedServiceDate(row(1, 'fixTime', { next: now - DAY, remaining: -DAY }), rates, now),
    ).toBe(now);
  });

  it('has no date for a parked vehicle or an unknown value', () => {
    expect(
      expectedServiceDate(row(2, 'totalDistance', { next: 2, remaining: 1 }), rates, now),
    ).toBeNull();
    expect(
      expectedServiceDate(row(1, 'totalDistance', { next: null, remaining: null }), rates, now),
    ).toBeNull();
  });
});

describe('calendarEntries', () => {
  it('groups by day and keeps overdue and undated apart', () => {
    const rates = { 1: { distance: 100000, hours: 0 } };
    const rows = [
      row(1, 'fixTime', { status: 'ok', next: now + 3 * DAY, remaining: 3 * DAY }),
      row(1, 'totalDistance', { status: 'due', next: 2, remaining: 300000 }),
      row(1, 'odometer', { status: 'overdue', next: 1, remaining: -1 }),
      row(1, 'hours', { status: 'ok', next: 5, remaining: 5 }),
    ];
    const { byDay, overdue, undated } = calendarEntries(rows, rates, now);
    const key = dayKey(now + 3 * DAY);
    expect(byDay[key].map((entry) => entry.maintenance.type)).toEqual(['fixTime', 'totalDistance']);
    expect(byDay[key][0].forecast).toBe(false);
    expect(byDay[key][1].forecast).toBe(true);
    expect(overdue.map((entry) => entry.maintenance.type)).toEqual(['odometer']);
    expect(undated.map((entry) => entry.maintenance.type)).toEqual(['hours']);
  });

  it('formats the day key in local time', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

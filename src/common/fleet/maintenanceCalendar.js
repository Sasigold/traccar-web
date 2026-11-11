// ADM-31: when each maintenance falls, for the calendar of the maintenance plans. Pure, unit-tested.
//
// A plan by date (`*Time`) has its own date. A plan by distance or engine hours has a date only
// as a forecast: what is left, divided by how much the vehicle drove (or ran) per day lately.

import { isTimeType } from './maintenanceStatus';

const DAY = 86400000;

const DISTANCE_TYPES = new Set(['totalDistance', 'odometer', 'distance']);
const HOURS_TYPES = new Set(['hours']);

/**
 * Daily usage of each vehicle over the last `days` days, from a Traccar summary report.
 * @param {{ deviceId: number, distance?: number, engineHours?: number }[]} summary
 * @param {number} days
 * @returns {Record<number, { distance: number, hours: number }>} meters and ms per day
 */
export const dailyRates = (summary, days) => {
  /** @type {Record<number, { distance: number, hours: number }>} */
  const rates = {};
  if (!(days > 0)) {
    return rates;
  }
  (summary || []).forEach((row) => {
    rates[row.deviceId] = {
      distance: Math.max(0, row.distance || 0) / days,
      hours: Math.max(0, row.engineHours || 0) / days,
    };
  });
  return rates;
};

/**
 * The expected date of the next service, in ms, or null when it cannot be told.
 * Overdue plans fall on `now`, so they show today and in the overdue list.
 * @param {{ deviceId: number, maintenance: { type: string }, state: { next: number | null, remaining: number | null } }} row
 * @param {Record<number, { distance: number, hours: number }>} rates
 * @param {number} now
 */
export const expectedServiceDate = (row, rates, now = Date.now()) => {
  const { next, remaining } = row.state;
  const { type } = row.maintenance;
  if (next == null || remaining == null) {
    return null;
  }
  if (isTimeType(type)) {
    return Math.max(next, now);
  }
  if (remaining <= 0) {
    return now;
  }
  const rate = rates?.[row.deviceId];
  let perDay = 0;
  if (DISTANCE_TYPES.has(type)) {
    perDay = rate?.distance || 0;
  } else if (HOURS_TYPES.has(type)) {
    perDay = rate?.hours || 0;
  }
  if (!(perDay > 0)) {
    return null;
  }
  return now + Math.ceil(remaining / perDay) * DAY;
};

// 'YYYY-MM-DD' in local time, the key of a calendar day.
export const dayKey = (value) => {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Splits the rows into the calendar: by day, the overdue ones (listed apart, not on today), and
 * those with no date.
 * `forecast` marks a date that comes from the usage rate rather than the plan itself.
 */
export const calendarEntries = (rows, rates, now = Date.now()) => {
  const byDay = {};
  const overdue = [];
  const undated = [];
  (rows || []).forEach((row) => {
    const date = expectedServiceDate(row, rates, now);
    if (date == null) {
      undated.push(row);
      return;
    }
    if (row.state.status === 'overdue') {
      overdue.push({ ...row, date, forecast: false });
      return;
    }
    const entry = { ...row, date, forecast: !isTimeType(row.maintenance.type) };
    const key = dayKey(date);
    (byDay[key] = byDay[key] || []).push(entry);
  });
  return { byDay, overdue, undated };
};

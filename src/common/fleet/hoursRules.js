// ISR-07: driving and rest rules per kind of vehicle, and temporary permits (such as the 2026
// emergency permit). Pure, unit-tested.
//
// org_safety_settings.hours_rules holds the base rules, and now also:
//   byClass  { heavy: {...}, bus: {...}, light: {...} }  overrides per kind of vehicle
//   permits  [{ id, name, from, to, classes: ['heavy'] | [], rules: {...} }]
//            dates 'YYYY-MM-DD' inclusive; no classes means every vehicle.
// The numbers are parameters for the organization's safety officer, not law.

import { DEFAULT_HOURS_RULES, WEEKLY_REST_MINUTES } from './safety';

export const VEHICLE_CLASSES = ['light', 'heavy', 'bus'];
export const RULE_KEYS = [...Object.keys(DEFAULT_HOURS_RULES), 'minWeeklyRest'];

// Traccar's device category -> the kind of vehicle the rules know.
const HEAVY = ['truck', 'tractor', 'crane', 'trolleybus', 'tram', 'train'];
export const vehicleClass = (category) => {
  if (category === 'bus') return 'bus';
  if (HEAVY.includes(category)) return 'heavy';
  return 'light';
};

// The strictest kind a driver drove: heavy and bus rules apply when either was driven.
const RANK = { light: 0, bus: 1, heavy: 2 };
export const driverClass = (classes) =>
  (classes || []).reduce((worst, item) => (RANK[item] > RANK[worst] ? item : worst), 'light');

const numbers = (rules) =>
  Object.fromEntries(
    Object.entries(rules || {}).filter(
      ([key, value]) => RULE_KEYS.includes(key) && Number.isFinite(value) && value >= 0,
    ),
  );

const inPermit = (permit, cls, day) =>
  (!permit.classes?.length || permit.classes.includes(cls)) &&
  (!permit.from || day >= permit.from) &&
  (!permit.to || day <= permit.to);

/** Permits in force for a kind of vehicle on a day ('YYYY-MM-DD'). */
export const activePermits = (settings, cls, day) =>
  (settings?.permits || []).filter((permit) => inPermit(permit, cls, day));

/**
 * The rules for a kind of vehicle: defaults, the base, the kind's overrides, and (when `day` is
 * given) the permits in force that day, last one winning.
 */
export const rulesFor = (settings, cls = 'light', day = null) => {
  const merged = {
    ...DEFAULT_HOURS_RULES,
    minWeeklyRest: WEEKLY_REST_MINUTES,
    ...numbers(settings),
    ...numbers(settings?.byClass?.[cls]),
  };
  if (day) {
    activePermits(settings, cls, day).forEach((permit) =>
      Object.assign(merged, numbers(permit.rules)),
    );
  }
  return merged;
};

// Which limit a violation broke, and whether a smaller value is the breach (rest) or a bigger one.
const LIMITS = {
  continuous: ['maxContinuousDriving', 'max'],
  daily: ['maxDailyDriving', 'max'],
  weekly: ['maxWeeklyDriving', 'max'],
  rest: ['minDailyRest', 'min'],
  weeklyRest: ['minWeeklyRest', 'min'],
};

/**
 * Violations found with the kind's rules, less those a permit allowed on their day. Each one left
 * keeps its limit; the excused ones are returned apart, with the permit's name.
 */
export const applyPermits = (violations, settings, cls) => {
  const kept = [];
  const excused = [];
  violations.forEach((violation) => {
    const [key, direction] = LIMITS[violation.type] || [];
    const rules = rulesFor(settings, cls, violation.day);
    const limit = rules[key];
    const breach =
      key == null || (direction === 'max' ? violation.minutes > limit : violation.minutes < limit);
    if (breach) {
      kept.push(violation);
    } else {
      const permit = activePermits(settings, cls, violation.day).at(-1);
      excused.push({ ...violation, permit: permit?.name || '' });
    }
  });
  return { violations: kept, excused };
};

/** A permit as typed in the settings, cleaned: numbers only, dates in order. */
export const validPermit = (permit) =>
  Boolean(
    permit?.name?.trim() &&
    permit.from &&
    permit.to &&
    permit.to >= permit.from &&
    Object.keys(numbers(permit.rules)).length > 0,
  );

// OPS-07: tires over their life: slow leaks from the pressure trend, tread depth against the
// legal minimum, and what each tire cost per kilometer. Pure, tested.

// Israel's legal minimum tread depth for cars and light trucks (mm), and when to plan a change.
export const TREAD_LEGAL_MM = 1.6;
export const TREAD_PLAN_MM = 3;

export const treadStatus = (depth) => {
  if (depth == null || Number.isNaN(Number(depth))) return 'none';
  if (Number(depth) < TREAD_LEGAL_MM) return 'error';
  if (Number(depth) < TREAD_PLAN_MM) return 'warning';
  return 'ok';
};

const DAY = 24 * 3600 * 1000;

// Least squares slope of value over time, per day, with how well the line fits (r²).
const trend = (points) => {
  const n = points.length;
  const xs = points.map((p) => p.time / DAY);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, mean: my, r2 };
};

// A slow leak: since the last refill (a rise of 5% or more), the pressure falls steadily by at
// least `minDropPerDay` (a share of the mean, default 2% a day) over at least two days, with a
// good straight-line fit. series: [{ time (ms or ISO), value }] for one wheel, any order.
export const slowLeak = (series, { minDropPerDay = 0.02, minDays = 2, minPoints = 6 } = {}) => {
  const points = series
    .map((p) => ({ time: new Date(p.time).getTime(), value: Number(p.value) }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.time - b.time);
  let start = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].value >= points[i - 1].value * 1.05) start = i;
  }
  const since = points.slice(start);
  if (since.length < minPoints) return null;
  const days = (since[since.length - 1].time - since[0].time) / DAY;
  if (days < minDays) return null;
  const { slope, mean, r2 } = trend(since);
  if (slope >= 0 || r2 < 0.6 || -slope < mean * minDropPerDay) return null;
  return {
    perDay: -slope,
    since: new Date(since[0].time).toISOString(),
    // Days until the pressure is down by a quarter from where this stretch started.
    daysToLow: Math.max(0, (since[0].value * 0.75 - since[since.length - 1].value) / slope),
  };
};

// Cost per km of a tire: its price over the kilometers it has done (until removed, or until
// now). Null without a price or distance.
export const tireCostPerKm = (tire, currentOdometerKm) => {
  const end = tire.removed_odometer ?? currentOdometerKm;
  const km = Number(end) - Number(tire.installed_odometer);
  if (!(Number(tire.cost) > 0) || !(km > 0)) return null;
  return Number(tire.cost) / km;
};

// The wheel positions, front to back, for the vehicle's axle count (2: a car or van).
export const tirePositions = (axles = 2) => {
  const result = ['fl', 'fr'];
  for (let axle = 2; axle <= axles; axle += 1) {
    result.push(axle === axles ? 'rl' : `l${axle}`, axle === axles ? 'rr' : `r${axle}`);
  }
  return result;
};

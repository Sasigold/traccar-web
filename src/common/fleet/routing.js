import { ROAD_FACTOR, distanceKm } from './dispatch';

// OPS-03: the order of one vehicle's stops, worked out here (no routing server yet). Distances
// are straight lines times a road factor, at an average speed; each stop takes a few minutes.
// Nearest stop first, then 2-opt swaps while they lower the cost: driving minutes plus a heavy
// penalty per minute late against a stop's window end. Pure, tested.

export const DEFAULT_SPEED_KMH = 40;
export const SERVICE_MINUTES = 8;
const LATE_WEIGHT = 10;

const minutesBetween = (from, to, speedKmh) =>
  ((distanceKm(from, to) * ROAD_FACTOR) / speedKmh) * 60;

// Arrival times and lateness of stops visited in this order.
/**
 * @param {{ latitude: number, longitude: number }} start
 * @param {any[]} stops
 * @param {{ speedKmh?: number, startTime?: number }} [options]
 */
export const walkRoute = (start, stops, options = {}) => {
  const { speedKmh = DEFAULT_SPEED_KMH, startTime = Date.now() } = options;
  let clock = startTime;
  let at = start;
  let km = 0;
  let late = 0;
  const legs = stops.map((stop) => {
    const drive = minutesBetween(at, stop, speedKmh);
    km += distanceKm(at, stop) * ROAD_FACTOR;
    clock += drive * 60000;
    const due = stop.windowEnd ?? null;
    const lateMinutes = due != null && clock > due ? (clock - due) / 60000 : 0;
    late += lateMinutes;
    const leg = { stop, arrival: clock, lateMinutes };
    clock += SERVICE_MINUTES * 60000;
    at = stop;
    return leg;
  });
  return { legs, km: Math.round(km * 10) / 10, lateMinutes: Math.round(late), end: clock };
};

const cost = (start, stops, options) => {
  const { legs } = walkRoute(start, stops, options);
  const driving = (legs.at(-1)?.arrival ?? options.startTime) - options.startTime;
  return driving / 60000 + LATE_WEIGHT * legs.reduce((sum, leg) => sum + leg.lateMinutes, 0);
};

const nearestFirst = (start, stops) => {
  const left = [...stops];
  const order = [];
  let at = start;
  while (left.length) {
    let best = 0;
    left.forEach((stop, index) => {
      if (distanceKm(at, stop) < distanceKm(at, left[best])) best = index;
    });
    [at] = left.splice(best, 1);
    order.push(at);
  }
  return order;
};

export const planRoute = (start, stops, options = {}) => {
  const settings = { speedKmh: DEFAULT_SPEED_KMH, startTime: Date.now(), ...options };
  let order = nearestFirst(start, stops);
  let best = cost(start, order, settings);
  let improved = true;
  for (let round = 0; improved && round < 50; round += 1) {
    improved = false;
    for (let i = 0; i < order.length - 1; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        const value = cost(start, candidate, settings);
        if (value < best - 1e-9) {
          order = candidate;
          best = value;
          improved = true;
        }
      }
    }
  }
  return walkRoute(start, order, settings);
};

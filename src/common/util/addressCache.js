import { parse } from 'wellknown';

// REP-13: addresses in reports. One cache for the session, at most three geocoder requests at a
// time, and every row showing the same point updated together.
const cache = new Map();
const listeners = new Map();
const queue = [];
let running = 0;
export const MAX_PARALLEL = 3;

export const addressKey = (latitude, longitude) =>
  `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;

export const cachedAddress = (latitude, longitude) => cache.get(addressKey(latitude, longitude));

export const subscribeAddress = (key, listener) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
  return () => listeners.get(key)?.delete(listener);
};

const settle = (key, value) => {
  cache.set(key, value);
  listeners.get(key)?.forEach((listener) => listener(value));
};

const pump = (fetchAddress) => {
  while (running < MAX_PARALLEL && queue.length) {
    const { key, latitude, longitude, resolve } = queue.shift();
    running += 1;
    fetchAddress(latitude, longitude)
      .then((value) => {
        settle(key, value || '');
        resolve(value || '');
      })
      .catch(() => resolve(null))
      .finally(() => {
        running -= 1;
        pump(fetchAddress);
      });
  }
};

const pending = new Map();

export const requestAddress = (latitude, longitude, fetchAddress) => {
  const key = addressKey(latitude, longitude);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  const promise = new Promise((resolve) => {
    queue.push({ key, latitude, longitude, resolve });
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  pump(fetchAddress);
  return promise;
};

export const clearAddressCache = () => {
  cache.clear();
  pending.clear();
  queue.length = 0;
};

// Whether a point is inside a Traccar geofence ("CIRCLE (lat lon, r)" or a WKT polygon in
// "lat lon" order); the first one that holds it names the place.
const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const inRing = (ring, lat, lon) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

export const geofenceAt = (geofences, latitude, longitude) =>
  Object.values(geofences || {}).find((geofence) => {
    const area = geofence?.area || '';
    if (area.startsWith('CIRCLE')) {
      const [lat, lon, radius] = area
        .replace(/CIRCLE|\(|\)|,/g, ' ')
        .trim()
        .split(/ +/)
        .map(Number);
      return distanceMeters(lat, lon, latitude, longitude) <= radius;
    }
    if (area.startsWith('POLYGON')) {
      try {
        const geometry = parse(area);
        return inRing(geometry.coordinates[0], latitude, longitude);
      } catch {
        return false;
      }
    }
    return false;
  }) || null;

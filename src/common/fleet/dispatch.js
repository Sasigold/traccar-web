// Roadmap stage 5: dispatch jobs, ETA and customer tracking links (pure, tested).

export const JOB_STATUSES = [
  'planned',
  'assigned',
  'en_route',
  'arrived',
  'done',
  'failed',
  'cancelled',
];
export const JOB_TYPES = ['delivery', 'pickup', 'service', 'visit', 'other'];
export const JOB_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const isOpenJob = (status) => !['done', 'failed', 'cancelled'].includes(status);

// The next steps a driver may take from a status (the database allows only these for drivers).
export const driverNextStatuses = (status) => {
  switch (status) {
    case 'planned':
    case 'assigned':
      return ['en_route'];
    case 'en_route':
      return ['arrived'];
    case 'arrived':
      return ['done', 'failed'];
    default:
      return [];
  }
};

const toRad = (value) => (value * Math.PI) / 180;

// Great-circle distance in km.
export const distanceKm = (from, to) => {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hasPoint = (point) =>
  point != null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);

// Rough ETA in minutes: straight line x road factor at the current speed, or a city average
// when the vehicle is slow or stopped. Positions carry speed in knots (Traccar).
export const ROAD_FACTOR = 1.3;
export const DEFAULT_SPEED_KMH = 40;
export const ARRIVED_KM = 0.15;

export const estimateEta = (position, target) => {
  if (!hasPoint(position) || !hasPoint(target)) {
    return null;
  }
  const km = distanceKm(position, target) * ROAD_FACTOR;
  if (km <= ARRIVED_KM) {
    return { km: 0, minutes: 0 };
  }
  const speedKmh = (position.speed || 0) * 1.852;
  const speed = speedKmh >= 15 ? Math.min(speedKmh, 90) : DEFAULT_SPEED_KMH;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((km / speed) * 60)) };
};

// Expiry of a customer tracking link: an hour after the delivery window, or a few hours from now,
// and never more than MAX_TRACKING_HOURS ahead. A Traccar share link is a full (temporary)
// session, so a job planned for next week must not hand out a week of live tracking.
export const MAX_TRACKING_HOURS = 12;

export const trackingExpiry = (job, now = new Date(), hours = 4) => {
  const cap = new Date(now.getTime() + MAX_TRACKING_HOURS * 3600 * 1000);
  const fallback = new Date(now.getTime() + hours * 3600 * 1000);
  const windowEnd = job.window_end ? new Date(job.window_end) : null;
  if (windowEnd && windowEnd > now) {
    const afterWindow = new Date(windowEnd.getTime() + 3600 * 1000);
    return afterWindow < cap ? afterWindow : cap;
  }
  return fallback;
};

// Israeli mobile numbers to the international form wa.me expects (972...).
export const whatsappNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.startsWith('972')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `972${digits.slice(1)}`;
  }
  return digits;
};

export const whatsappLink = (phone, text) => {
  const number = whatsappNumber(phone);
  const query = `text=${encodeURIComponent(text)}`;
  return number ? `https://wa.me/${number}?${query}` : `https://wa.me/?${query}`;
};

// LIV-21: who is closest to a point on the map. Sorted by straight-line distance, each with the
// road ETA estimate; vehicles without a position, and disabled ones, are left out.
export const nearbyVehicles = (positions, devices, point, limit = 8) =>
  Object.values(positions || {})
    .filter((position) => hasPoint(position) && devices[position.deviceId])
    .filter((position) => !devices[position.deviceId].disabled)
    .map((position) => ({
      device: devices[position.deviceId],
      position,
      km: distanceKm(position, point),
      eta: estimateEta(position, point),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);

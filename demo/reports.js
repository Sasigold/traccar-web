export const geofences = [
  {
    id: 1,
    name: 'Whitehall',
    area: 'POLYGON ((51.499 -0.129, 51.509 -0.129, 51.509 -0.125, 51.499 -0.125, 51.499 -0.129))',
    attributes: {},
  },
];

// The first six keep their index: sample event ids encode it (id % 10).
export const eventTypes = [
  'ignitionOn',
  'deviceMoving',
  'geofenceEnter',
  'geofenceExit',
  'deviceStopped',
  'ignitionOff',
  'deviceOverspeed',
  'alarm',
  'maintenance',
  'deviceFuelDrop',
];

export const sampleEvent = (position, type) => ({
  id: position.id * 10 + eventTypes.indexOf(type),
  type,
  deviceId: position.deviceId,
  positionId: position.id,
  eventTime: position.fixTime,
  ...(type.startsWith('geofence') ? { geofenceId: 1 } : {}),
  attributes: {},
});

// ─── Generated history ────────────────────────────────────────────────────────
// Deterministic trips, stops and events for every past day, so dashboards and
// report pages show realistic shapes. Same request, same answer.

const DAY = 86400000;
const MINUTE = 60000;
const KNOTS_PER_KMH = 1 / 1.852;
const HISTORY_DAYS = 93;
// Generated trips stay clear of the live sample trip (15 to 5 minutes ago).
const LIVE_MARGIN = 20 * MINUTE;
// Generated event ids live far above the sample ids (position id × 10 + type).
const EVENT_BASE = 1e15;
const EVENT_DEVICE = 1e11;
const EVENT_DAY = 1e5;

const drivers = [
  { uniqueId: '0A1B2C3D', name: 'דנה לוי' },
  { uniqueId: '1B2C3D4E', name: 'Yossi Cohen' },
  { uniqueId: '2C3D4E5F', name: 'Noa Mizrahi' },
];

const places = [
  { address: 'Whitehall, London', latitude: 51.5045, longitude: -0.1263 },
  { address: "King's Cross, London", latitude: 51.5308, longitude: -0.1238 },
  { address: 'Canary Wharf, London', latitude: 51.5054, longitude: -0.0235 },
  { address: 'Paddington, London', latitude: 51.5154, longitude: -0.1755 },
  { address: 'Southwark, London', latitude: 51.5035, longitude: -0.0904 },
  { address: 'Camden Town, London', latitude: 51.539, longitude: -0.1426 },
  { address: 'Battersea, London', latitude: 51.4791, longitude: -0.1465 },
];

// Per device: how far it drives, how hard, and whether it burns fuel.
const profiles = {
  1: { scale: 1.1, risk: 0.5, fuel: 0.1 },
  2: { scale: 0.9, risk: 1.4, fuel: 0.09 },
  3: { scale: 1.2, risk: 0.3, fuel: 0.07 },
  4: { scale: 1.3, risk: 0.9, fuel: 0.075 },
  5: { scale: 0.8, risk: 0.6, fuel: 0 },
  6: { scale: 1.5, risk: 1.1, fuel: 0.22 },
};

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const iso = (time) => new Date(time).toISOString();

const baseOdometer = (deviceId) => (12000 + (deviceId - 1) * 8000) * 1000;
const baseHours = (deviceId) => (2400 + deviceId * 310) * 3600000;

const plans = new Map();

// One device-day: trips, the stops between them and their events (full day,
// trimmed to "now" by the caller). Odometers are relative to the start of the
// day; `generated` turns them into absolute readings.
const dayPlan = (device, day) => {
  if (plans.size > 4000) plans.clear();
  const key = `${device.id}:${day}`;
  const cached = plans.get(key);
  if (cached) return cached;
  const random = mulberry32(device.id * 1000003 + day * 7919);
  const between = (min, max) => min + (max - min) * random();
  const profile = profiles[device.id] || profiles[1];
  const weekday = new Date(day * DAY).getUTCDay();
  let count;
  if (weekday === 6) {
    count = random() < 0.65 ? 0 : 1;
  } else if (weekday === 5) {
    count = 1 + Math.floor(random() * 3);
  } else {
    count = 2 + Math.floor(random() * 5);
  }
  const maxDuration = weekday === 5 || weekday === 6 ? 35 : 75;
  const driver = drivers[(device.id + day) % drivers.length];
  let odometer = 0;
  let time = day * DAY + (6 * 60 + between(0, 150)) * MINUTE;
  let place = Math.floor(random() * places.length);
  const trips = [];
  const stops = [];
  const events = [];
  let seq = 0;
  const event = (type, eventTime, extra = {}) => {
    events.push({
      id: EVENT_BASE + device.id * EVENT_DEVICE + day * EVENT_DAY + seq,
      type,
      deviceId: device.id,
      eventTime: iso(eventTime),
      attributes: {},
      ...extra,
    });
    seq += 1;
  };
  for (let index = 0; index < count; index += 1) {
    const durationMinutes = between(8, maxDuration) * (0.8 + 0.2 * profile.scale);
    const speedKmh = between(25, 70);
    const duration = Math.round(durationMinutes * MINUTE);
    const distance = Math.round(speedKmh * (durationMinutes / 60) * 1000);
    const start = places[place];
    place = (place + 1 + Math.floor(random() * (places.length - 1))) % places.length;
    const end = places[place];
    const startTime = Math.round(time);
    const endTime = startTime + duration;
    if (endTime > day * DAY + 21 * 60 * MINUTE) break;
    const averageSpeed = speedKmh * KNOTS_PER_KMH;
    const maxSpeed = averageSpeed * between(1.25, 1.7);
    const spentFuel = +((distance / 1000) * profile.fuel * between(0.85, 1.15)).toFixed(2);
    trips.push({
      deviceId: device.id,
      startTime: iso(startTime),
      endTime: iso(endTime),
      startLat: start.latitude,
      startLon: start.longitude,
      endLat: end.latitude,
      endLon: end.longitude,
      startAddress: start.address,
      endAddress: end.address,
      startOdometer: odometer,
      endOdometer: odometer + distance,
      distance,
      duration,
      averageSpeed: +averageSpeed.toFixed(2),
      maxSpeed: +maxSpeed.toFixed(2),
      spentFuel,
      driverUniqueId: driver.uniqueId,
      driverName: driver.name,
      business: true,
    });
    odometer += distance;
    event('ignitionOn', startTime);
    event('deviceMoving', startTime + MINUTE);
    const overspeeds = Math.floor(random() * 2.2 * profile.risk);
    for (let i = 0; i < overspeeds; i += 1) {
      const speedLimit = random() < 0.6 ? 27 : 48.6;
      event('deviceOverspeed', startTime + between(0.1, 0.9) * duration, {
        attributes: { speed: +(speedLimit * between(1.1, 1.35)).toFixed(1), speedLimit },
      });
    }
    if (random() < 0.3) {
      event('geofenceEnter', startTime + 0.2 * duration, { geofenceId: 1 });
      event('geofenceExit', startTime + 0.6 * duration, { geofenceId: 1 });
    }
    if (random() < 0.25 * profile.risk) {
      const roll = random();
      let alarm = 'hardCornering';
      if (roll < 0.45) alarm = 'hardBraking';
      else if (roll < 0.8) alarm = 'hardAcceleration';
      event('alarm', startTime + between(0.1, 0.9) * duration, { attributes: { alarm } });
    }
    if (random() < 0.004) {
      event('alarm', startTime + 0.5 * duration, { attributes: { alarm: 'sos' } });
    }
    if (profile.fuel > 0 && random() < 0.02) {
      event('deviceFuelDrop', endTime + 2 * MINUTE);
    }
    event('deviceStopped', endTime);
    const gap = between(15, 160) * MINUTE;
    const idle = Math.min(gap, Math.round(between(0, 20) * MINUTE));
    event('ignitionOff', endTime + idle);
    if (index < count - 1) {
      stops.push({
        deviceId: device.id,
        startTime: iso(endTime),
        endTime: iso(endTime + gap),
        duration: Math.round(gap),
        engineHours: idle,
        spentFuel: +((idle / 3600000) * 0.8 * (profile.fuel > 0 ? 1 : 0)).toFixed(2),
        latitude: end.latitude,
        longitude: end.longitude,
        address: end.address,
        startOdometer: odometer,
      });
    }
    time = endTime + gap;
  }
  if (device.id !== 5 && (device.id * 7 + day) % 23 === 0) {
    event('maintenance', day * DAY + 7 * 60 * MINUTE, { maintenanceId: 1 });
  }
  events.sort((a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime));
  const plan = { trips, stops, events };
  plans.set(key, plan);
  return plan;
};

// Days (UTC day numbers) overlapping [from, to], at most HISTORY_DAYS back, none in the future.
const daysIn = (from, to, now) => {
  const first = Math.max(Math.floor(Math.max(from, now - HISTORY_DAYS * DAY) / DAY), 0);
  const last = Math.floor(Math.min(to, now) / DAY);
  const days = [];
  for (let day = first; day <= last; day += 1) days.push(day);
  return days;
};

const beforeNow = (row, now) => Date.parse(row.endTime ?? row.eventTime) <= now - LIVE_MARGIN;

// The day plan as far as it has happened.
const visible = (device, day, now) => {
  const plan = dayPlan(device, day);
  if (day < Math.floor(now / DAY)) return plan;
  return {
    trips: plan.trips.filter((trip) => beforeNow(trip, now)),
    stops: plan.stops.filter((stop) => beforeNow(stop, now)),
    events: plan.events.filter((event) => beforeNow(event, now)),
  };
};

const distanceOf = (plan) => plan.trips.reduce((sum, trip) => sum + trip.distance, 0);
const engineOf = (plan) =>
  plan.trips.reduce((sum, trip) => sum + trip.duration, 0) +
  plan.stops.reduce((sum, stop) => sum + stop.engineHours, 0);

// The live sample trip (4 km, 10 minutes) ends at the current reading.
const SAMPLE_DISTANCE = 4000;
const SAMPLE_DURATION = 600000;

// Odometer and engine hours at the start of `day`: everything driven since
// then comes off the current reading.
const countersAt = (device, day, now) => {
  let odometer = baseOdometer(device.id) - SAMPLE_DISTANCE;
  let hours = baseHours(device.id) - SAMPLE_DURATION;
  for (let current = Math.floor(now / DAY); current >= day; current -= 1) {
    const plan = visible(device, current, now);
    odometer -= distanceOf(plan);
    hours -= engineOf(plan);
  }
  return { odometer, hours };
};

const generated = (device, from, to, now) => {
  const days = daysIn(from, to, now);
  if (!days.length) return [];
  let { odometer, hours } = countersAt(device, days[0], now);
  return days.map((day) => {
    const plan = visible(device, day, now);
    const item = {
      day,
      trips: plan.trips.map((trip) => ({
        ...trip,
        startOdometer: trip.startOdometer + odometer,
        endOdometer: trip.endOdometer + odometer,
      })),
      stops: plan.stops.map((stop) => ({ ...stop, startOdometer: stop.startOdometer + odometer })),
      events: plan.events,
      startOdometer: odometer,
      startHours: hours,
    };
    odometer += distanceOf(plan);
    hours += engineOf(plan);
    return { ...item, endOdometer: odometer, endHours: hours };
  });
};

const summarize = (device, trips, stops, counters, startTime, endTime) => {
  const distance = trips.reduce((sum, trip) => sum + trip.distance, 0);
  const weighted = trips.reduce((sum, trip) => sum + trip.averageSpeed * trip.distance, 0);
  return {
    deviceId: device.id,
    deviceName: device.name,
    startTime,
    endTime,
    distance,
    averageSpeed: distance > 0 ? +(weighted / distance).toFixed(2) : 0,
    maxSpeed: trips.reduce((max, trip) => Math.max(max, trip.maxSpeed), 0),
    engineHours: counters.endHours - counters.startHours,
    startHours: counters.startHours,
    endHours: counters.endHours,
    spentFuel: +trips.reduce((sum, trip) => sum + trip.spentFuel, 0).toFixed(2),
    startOdometer: counters.startOdometer,
    endOdometer: counters.endOdometer,
  };
};

// Event id → event, for api/events/:id on generated events.
export const findEvent = (fleet, id) => {
  if (id < EVENT_BASE) return null;
  const deviceId = Math.floor((id - EVENT_BASE) / EVENT_DEVICE);
  const day = Math.floor((id - EVENT_BASE - deviceId * EVENT_DEVICE) / EVENT_DAY);
  const device = fleet.devices.find((item) => item.id === deviceId);
  if (!device) return null;
  const event = dayPlan(device, day).events.find((item) => item.id === id);
  return event ? { ...event, positionId: device.positionId } : null;
};

export const report = (fleet, type, params) => {
  const now = Date.now();
  const from = params.has('from') ? Date.parse(params.get('from')) : -Infinity;
  const to = params.has('to') ? Date.parse(params.get('to')) : Infinity;
  const deviceIds = params.getAll('deviceId').map(Number);
  const groupIds = params.getAll('groupId').map(Number);
  const types = params.getAll('type');
  const alarms = params.getAll('alarm');
  const geofenceIds = params.getAll('geofenceId').map(Number);
  const daily = params.get('daily') === 'true';
  const history = fleet.query(new URLSearchParams({ from: '1970-01-01', to: '9999-01-01' }));
  const inRange = (row) => Date.parse(row.endTime) >= from && Date.parse(row.startTime) <= to;
  const typeMatches = (event) => {
    if (!types.length || types.includes('allEvents')) return true;
    if (!types.includes(event.type)) return false;
    return event.type !== 'alarm' || !alarms.length || alarms.includes(event.attributes.alarm);
  };
  return fleet.devices
    .filter((device) =>
      deviceIds.length || groupIds.length
        ? deviceIds.includes(device.id) || groupIds.includes(device.groupId)
        : true,
    )
    .flatMap((device) => {
      const all = history.filter((position) => position.deviceId === device.id);
      const positions = all.filter(
        (position) => Date.parse(position.fixTime) >= from && Date.parse(position.fixTime) <= to,
      );
      // Sample trip from 15 to 5 minutes ago, followed by a stop.
      const start = all.at(-181);
      const end = all.at(-61);
      const latest = all.at(-1);
      const driver = drivers[(device.id + Math.floor(now / DAY)) % drivers.length];
      const trip = {
        deviceId: device.id,
        startTime: start.fixTime,
        endTime: end.fixTime,
        startPositionId: start.id,
        endPositionId: end.id,
        startLat: start.latitude,
        startLon: start.longitude,
        endLat: end.latitude,
        endLon: end.longitude,
        startAddress: start.address,
        endAddress: end.address,
        startOdometer: start.attributes.totalDistance - 4000,
        endOdometer: end.attributes.totalDistance,
        distance: 4000,
        duration: 600000,
        averageSpeed: 13,
        maxSpeed: 20,
        spentFuel: 0.4,
        driverUniqueId: driver.uniqueId,
        driverName: driver.name,
        business: false,
      };
      const stop = {
        deviceId: device.id,
        startTime: end.fixTime,
        endTime: latest.fixTime,
        duration: 300000,
        positionId: end.id,
        latitude: end.latitude,
        longitude: end.longitude,
        address: end.address,
        startOdometer: end.attributes.totalDistance,
        engineHours: 0,
      };
      const events = [
        sampleEvent(start, 'ignitionOn'),
        sampleEvent(start, 'deviceMoving'),
        sampleEvent(start, 'geofenceEnter'),
        sampleEvent(end, 'geofenceExit'),
        sampleEvent(end, 'deviceStopped'),
        sampleEvent(end, 'ignitionOff'),
      ].filter((event) => Date.parse(event.eventTime) >= from && Date.parse(event.eventTime) <= to);
      const needsHistory = ['trips', 'stops', 'summary', 'events'].includes(type);
      const days = needsHistory ? generated(device, from, to, now) : [];
      const pastTrips = days.flatMap((item) => item.trips);
      const pastStops = days.flatMap((item) => item.stops);
      switch (type) {
        case 'route':
          return positions;
        case 'combined':
          return positions.length
            ? [
                {
                  deviceId: device.id,
                  positions,
                  events,
                  route: positions.map((position) => [position.longitude, position.latitude]),
                },
              ]
            : [];
        case 'events':
          return [
            ...days
              .flatMap((item) => item.events)
              .filter(
                (event) => Date.parse(event.eventTime) >= from && Date.parse(event.eventTime) <= to,
              )
              .map((event) => ({ ...event, positionId: latest.id })),
            ...events,
          ].filter(typeMatches);
        case 'trips':
          return [...pastTrips, trip].filter(inRange);
        case 'stops':
          return [...pastStops.map((item) => ({ ...item, positionId: latest.id })), stop].filter(
            inRange,
          );
        case 'summary': {
          const today = Math.floor(now / DAY);
          // Today's row also counts the live sample trip.
          const live = (item) =>
            item.day === today && inRange(trip)
              ? {
                  ...item,
                  trips: [...item.trips, trip],
                  endOdometer: item.endOdometer + SAMPLE_DISTANCE,
                  endHours: item.endHours + SAMPLE_DURATION,
                }
              : item;
          const items = days.map(live);
          if (daily) {
            return items.map((item) =>
              summarize(
                device,
                item.trips,
                item.stops,
                item,
                iso(Math.max(item.day * DAY, from)),
                iso(Math.min((item.day + 1) * DAY - 1, to, now)),
              ),
            );
          }
          if (!items.length) return [];
          return [
            summarize(
              device,
              items.flatMap((item) => item.trips),
              items.flatMap((item) => item.stops),
              {
                startOdometer: items[0].startOdometer,
                startHours: items[0].startHours,
                endOdometer: items.at(-1).endOdometer,
                endHours: items.at(-1).endHours,
              },
              iso(Math.max(from, items[0].day * DAY)),
              iso(Math.min(to, now)),
            ),
          ];
        }
        case 'geofences':
          return (
            !geofenceIds.length || geofenceIds.includes(1)
              ? [
                  {
                    deviceId: device.id,
                    geofenceId: 1,
                    startTime: start.fixTime,
                    endTime: end.fixTime,
                  },
                ]
              : []
          ).filter(inRange);
        default:
          return [];
      }
    });
};

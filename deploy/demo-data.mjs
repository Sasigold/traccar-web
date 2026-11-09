#!/usr/bin/env node
/*
 * Demo data for a live Traccar server.
 *
 * Creates an Israeli demo fleet (groups, drivers, geofences, devices) through the
 * REST API and feeds it positions over the OsmAnd protocol, so the map, reports
 * and replay have something to show.
 *
 *   node deploy/demo-data.mjs run      seed + backfill history + live simulation (default)
 *   node deploy/demo-data.mjs seed     create groups, drivers, geofences and devices only
 *   node deploy/demo-data.mjs simulate backfill history + live simulation (seed must exist)
 *   node deploy/demo-data.mjs clean    delete everything this script created
 *
 * Options (or environment variables):
 *   --url       TRACCAR_URL       web/API address, e.g. http://72.61.153.60:8082
 *   --email     TRACCAR_EMAIL     admin user
 *   --password  TRACCAR_PASSWORD  admin password
 *   --token     TRACCAR_TOKEN     API token instead of email/password
 *   --osmand    TRACCAR_OSMAND    OsmAnd endpoint (default: same host, port 5055)
 *   --history   hours of past track to backfill (default 3, 0 to skip)
 *   --interval  seconds between live updates (default 10)
 *   --no-osrm   do not fetch road geometry from router.project-osrm.org
 *   --allow-production   seed the production server anyway (refused by default, FND-04)
 *
 * Everything created is tagged (uniqueId prefix "demo-il-", attribute demoData=true)
 * so "clean" removes exactly that and nothing else. Requires Node 18+.
 */

import { parseArgs } from 'node:util';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string', default: process.env.TRACCAR_URL },
    email: { type: 'string', default: process.env.TRACCAR_EMAIL },
    password: { type: 'string', default: process.env.TRACCAR_PASSWORD },
    token: { type: 'string', default: process.env.TRACCAR_TOKEN },
    osmand: { type: 'string', default: process.env.TRACCAR_OSMAND },
    history: { type: 'string', default: '3' },
    interval: { type: 'string', default: '10' },
    'no-osrm': { type: 'boolean', default: false },
    'allow-production': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const command = positionals[0] || 'run';

if (args.help || !['run', 'seed', 'simulate', 'clean'].includes(command)) {
  console.log(
    'Usage: node deploy/demo-data.mjs [run|seed|simulate|clean] --url <url> --email <email> --password <password>',
  );
  process.exit(args.help ? 0 : 1);
}

if (!args.url || (!args.token && !(args.email && args.password))) {
  console.error('Missing --url and credentials (--email/--password or --token).');
  process.exit(1);
}

const baseUrl = args.url.replace(/\/+$/, '');

// FND-04: demo vehicles on the production server skew the admin KPIs, "devices without a customer"
// and the billing counts. Use the staging server; production only on explicit request.
const PRODUCTION_TRACCAR = ['traccar-ovjj.srv2122641.hstgr.cloud', '72.61.153.60:8082'];
const target = new URL(baseUrl);
const isProduction =
  PRODUCTION_TRACCAR.includes(target.hostname) || PRODUCTION_TRACCAR.includes(target.host);
if (isProduction && !args['allow-production']) {
  console.error(
    `${target.host} is the production server. Seed the staging server instead, or pass --allow-production.`,
  );
  process.exit(1);
}
const osmandUrl = (
  args.osmand || `${new URL(baseUrl).protocol}//${new URL(baseUrl).hostname}:5055`
).replace(/\/+$/, '');
const historyHours = Number(args.history);
const intervalSeconds = Math.max(2, Number(args.interval));

const PREFIX = 'demo-il-';
const DRIVER_PREFIX = 'demo-il-drv-';
const TAG = { demoData: true };

// ---------------------------------------------------------------------------
// Fleet definition
// ---------------------------------------------------------------------------

const groups = [
  { key: 'distribution', name: 'הפצה ולוגיסטיקה' },
  { key: 'service', name: 'שירות שטח' },
  { key: 'management', name: 'הנהלה' },
  { key: 'transport', name: 'הסעות' },
];

const drivers = [
  { key: 'yossi', name: 'יוסי כהן' },
  { key: 'dana', name: 'דנה לוי' },
  { key: 'avi', name: 'אבי מזרחי' },
  { key: 'noa', name: 'נועה פרץ' },
  { key: 'moshe', name: 'משה ביטון' },
  { key: 'rina', name: 'רינה אברהם' },
  { key: 'omer', name: 'עומר דהן' },
  { key: 'shira', name: 'שירה אזולאי' },
];

// [latitude, longitude, radius in meters]
const geofences = [
  {
    key: 'warehouse',
    name: 'מחסן מרכזי – ראשון לציון',
    circle: [31.9895, 34.7712, 400],
    groups: ['distribution'],
  },
  {
    key: 'hq',
    name: 'משרדים ראשיים – תל אביב',
    circle: [32.0744, 34.7915, 250],
    groups: ['management', 'service'],
  },
  { key: 'haifaPort', name: 'נמל חיפה', circle: [32.8197, 35.0006, 900], groups: ['distribution'] },
  {
    key: 'ashdodPort',
    name: 'נמל אשדוד',
    circle: [31.8236, 34.6447, 900],
    groups: ['distribution'],
  },
  { key: 'jerusalem', name: 'סניף ירושלים', circle: [31.7857, 35.2007, 300], groups: ['service'] },
  {
    key: 'depot',
    name: 'חניון הסעות – פתח תקווה',
    circle: [32.0996, 34.8862, 300],
    groups: ['transport'],
  },
];

// Waypoints are [longitude, latitude]. mode: drive (moving), idle (parked, reporting),
// offline (one old report, then silent), never (registered but never reported).
const vehicles = [
  {
    id: 'truck-01',
    name: 'משאית חלוקה 12-345-67',
    category: 'truck',
    group: 'distribution',
    driver: 'yossi',
    model: 'Volvo FL',
    maxKmh: 85,
    fuel: 72,
    route: [
      [34.7712, 31.9895],
      [34.7915, 32.0744],
      [34.8245, 32.0853],
    ],
  },
  {
    id: 'truck-02',
    name: 'משאית קירור 23-456-78',
    category: 'truck',
    group: 'distribution',
    driver: 'moshe',
    model: 'Mercedes Atego',
    maxKmh: 90,
    fuel: 54,
    route: [
      [35.0006, 32.8197],
      [34.9196, 32.434],
      [34.8532, 32.3215],
    ],
  },
  {
    id: 'truck-03',
    name: 'משאית מכולות 34-567-89',
    category: 'truck',
    group: 'distribution',
    driver: 'omer',
    model: 'DAF XF',
    maxKmh: 80,
    fuel: 38,
    route: [
      [34.6447, 31.8236],
      [34.5715, 31.6688],
    ],
  },
  {
    id: 'van-01',
    name: 'ואן שירות – ירושלים',
    category: 'van',
    group: 'service',
    driver: 'dana',
    model: 'Ford Transit',
    maxKmh: 95,
    fuel: 63,
    route: [
      [35.2007, 31.7857],
      [35.1495, 31.7966],
      [34.9888, 31.747],
    ],
  },
  {
    id: 'van-02',
    name: 'ואן טכנאי – באר שבע',
    category: 'van',
    group: 'service',
    driver: 'avi',
    model: 'Renault Master',
    maxKmh: 90,
    fuel: 47,
    route: [
      [34.7915, 31.252],
      [34.6203, 31.3134],
    ],
  },
  {
    id: 'pickup-01',
    name: 'טנדר שטח – גליל',
    category: 'pickup',
    group: 'service',
    driver: 'shira',
    model: 'Toyota Hilux',
    maxKmh: 80,
    fuel: 81,
    route: [
      [35.295, 32.919],
      [35.496, 32.9646],
    ],
  },
  {
    id: 'car-01',
    name: 'רכב מנכ"ל',
    category: 'car',
    group: 'management',
    driver: 'noa',
    model: 'Skoda Superb',
    maxKmh: 110,
    fuel: 66,
    route: [
      [34.7915, 32.0744],
      [34.802, 32.165],
      [34.871, 32.184],
    ],
  },
  {
    id: 'moto-01',
    name: 'שליח אופנוע – מרכז העיר',
    category: 'motorcycle',
    group: 'distribution',
    driver: 'rina',
    model: 'Honda PCX',
    maxKmh: 55,
    battery: 88,
    route: [
      [34.7741, 32.08],
      [34.7745, 32.064],
      [34.752, 32.053],
      [34.769, 32.056],
    ],
  },
  {
    id: 'bus-01',
    name: 'אוטובוס הסעות עובדים',
    category: 'bus',
    group: 'transport',
    model: 'Mercedes Sprinter',
    maxKmh: 75,
    fuel: 58,
    route: [
      [34.8862, 32.0996],
      [34.833, 32.084],
      [34.7915, 32.0744],
    ],
  },
  {
    id: 'car-02',
    name: 'רכב מכירות – חונה',
    category: 'car',
    group: 'management',
    model: 'Hyundai Ioniq 5',
    mode: 'idle',
    fuel: 0,
    battery: 76,
    route: [[34.793, 32.0752]],
  },
  {
    id: 'van-03',
    name: 'ואן תחזוקה – מודיעין',
    category: 'van',
    group: 'service',
    model: 'Peugeot Boxer',
    mode: 'offline',
    fuel: 22,
    route: [[35.0095, 31.8969]],
  },
  {
    id: 'trailer-01',
    name: 'נגרר 501',
    category: 'trailer',
    group: 'distribution',
    model: 'Krone',
    mode: 'never',
    route: [],
  },
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const authHeader = args.token
  ? `Bearer ${args.token}`
  : `Basic ${Buffer.from(`${args.email}:${args.password}`).toString('base64')}`;

const api = async (method, path, body) => {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} /api/${path} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return response.status === 204 ? null : response.json().catch(() => null);
};

const listAll = async (path) => {
  try {
    return await api('GET', `${path}?all=true`);
  } catch {
    return api('GET', path);
  }
};

const sendPosition = async (uniqueId, point) => {
  const params = new URLSearchParams({
    id: uniqueId,
    lat: point.latitude.toFixed(6),
    lon: point.longitude.toFixed(6),
    timestamp: String(Math.round(point.time / 1000)),
    speed: (point.speedKmh / 1.852).toFixed(1), // OsmAnd speed is in knots
    bearing: point.course.toFixed(0),
    altitude: String(point.altitude ?? 40),
    accuracy: '5',
    ...Object.fromEntries(
      Object.entries(point.attributes).map(([key, value]) => [key, String(value)]),
    ),
  });
  const response = await fetch(`${osmandUrl}/?${params}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`OsmAnd ${response.status} for ${uniqueId}`);
  }
};

const runLimited = async (tasks, limit = 8) => {
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      await task();
    }
  });
  await Promise.all(workers);
};

// ---------------------------------------------------------------------------
// Seed / clean
// ---------------------------------------------------------------------------

const isDemo = (item) =>
  item?.attributes?.demoData === true || item?.attributes?.demoData === 'true';

const seed = async () => {
  const visible = await api('GET', 'devices');
  console.log(`Connected to ${baseUrl} (${visible.length} devices visible)`);

  const existingGroups = (await listAll('groups')).filter(isDemo);
  const groupIds = {};
  for (const group of groups) {
    let item = existingGroups.find((it) => it.name === group.name);
    if (!item) {
      item = await api('POST', 'groups', { name: group.name, attributes: TAG });
      console.log(`  + group     ${group.name}`);
    }
    groupIds[group.key] = item.id;
  }

  const existingDrivers = await listAll('drivers');
  for (const driver of drivers) {
    const uniqueId = DRIVER_PREFIX + driver.key;
    if (!existingDrivers.some((it) => it.uniqueId === uniqueId)) {
      await api('POST', 'drivers', { name: driver.name, uniqueId, attributes: TAG });
      console.log(`  + driver    ${driver.name}`);
    }
  }

  const existingGeofences = (await listAll('geofences')).filter(isDemo);
  for (const geofence of geofences) {
    let item = existingGeofences.find((it) => it.name === geofence.name);
    if (!item) {
      const [lat, lon, radius] = geofence.circle;
      item = await api('POST', 'geofences', {
        name: geofence.name,
        area: `CIRCLE (${lat} ${lon}, ${radius})`,
        attributes: TAG,
      });
      console.log(`  + geofence  ${geofence.name}`);
      for (const groupKey of geofence.groups) {
        await api('POST', 'permissions', { groupId: groupIds[groupKey], geofenceId: item.id });
      }
    }
  }

  const existingDevices = await listAll('devices');
  for (const vehicle of vehicles) {
    const uniqueId = PREFIX + vehicle.id;
    if (!existingDevices.some((it) => it.uniqueId === uniqueId)) {
      await api('POST', 'devices', {
        name: vehicle.name,
        uniqueId,
        category: vehicle.category,
        groupId: groupIds[vehicle.group],
        model: vehicle.model,
        phone: `+97250${String(2345671 + vehicles.indexOf(vehicle) * 104729).slice(-7)}`,
        attributes: TAG,
      });
      console.log(`  + device    ${vehicle.name}`);
    }
  }
  console.log('Seed complete.');
};

const clean = async () => {
  const devices = (await listAll('devices')).filter((it) => it.uniqueId?.startsWith(PREFIX));
  for (const item of devices) {
    await api('DELETE', `devices/${item.id}`);
    console.log(`  - device    ${item.name}`);
  }
  const driversList = (await listAll('drivers')).filter((it) =>
    it.uniqueId?.startsWith(DRIVER_PREFIX),
  );
  for (const item of driversList) {
    await api('DELETE', `drivers/${item.id}`);
    console.log(`  - driver    ${item.name}`);
  }
  for (const item of (await listAll('geofences')).filter(isDemo)) {
    await api('DELETE', `geofences/${item.id}`);
    console.log(`  - geofence  ${item.name}`);
  }
  for (const item of (await listAll('groups')).filter(isDemo)) {
    await api('DELETE', `groups/${item.id}`);
    console.log(`  - group     ${item.name}`);
  }
  console.log('Demo data removed.');
};

// ---------------------------------------------------------------------------
// Route geometry and motion
// ---------------------------------------------------------------------------

const toRad = (deg) => (deg * Math.PI) / 180;

const distance = ([lon1, lat1], [lon2, lat2]) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const bearing = ([lon1, lat1], [lon2, lat2]) => {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const roadGeometry = async (waypoints) => {
  if (waypoints.length < 2) return waypoints;
  if (!args['no-osrm']) {
    try {
      const coordinates = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        { headers: { 'User-Agent': 'traccar-demo-data' }, signal: AbortSignal.timeout(15000) },
      );
      const data = await response.json();
      const line = data.routes?.[0]?.geometry?.coordinates;
      if (line?.length > 1) return line;
    } catch {
      // fall through to straight lines
    }
  }
  return waypoints;
};

const buildPath = (line) => {
  const cumulative = [0];
  for (let i = 1; i < line.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distance(line[i - 1], line[i]));
  }
  return { line, cumulative, length: cumulative[cumulative.length - 1] };
};

const pointAt = (path, offset) => {
  const { line, cumulative } = path;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < offset) i += 1;
  const segment = cumulative[i] - cumulative[i - 1] || 1;
  const ratio = Math.min(1, Math.max(0, (offset - cumulative[i - 1]) / segment));
  const [lon1, lat1] = line[i - 1];
  const [lon2, lat2] = line[i];
  return {
    coordinate: [lon1 + (lon2 - lon1) * ratio, lat1 + (lat2 - lat1) * ratio],
    course: bearing(line[i - 1], line[i]),
  };
};

// Deterministic pseudo-random so every run looks plausible but varied per vehicle.
const random = (seedValue) => {
  let state = seedValue;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const createSimulator = (vehicle, path, index) => {
  const rand = random(index * 7919 + 17);
  const driverId = vehicle.driver ? DRIVER_PREFIX + vehicle.driver : null;
  const state = {
    offset: path.length * rand() * 0.6,
    direction: 1,
    speed: 0,
    pause: 0,
    stop: 0,
    fuel: vehicle.fuel ?? 0,
    battery: vehicle.battery ?? 100,
    odometer: (40000 + index * 13750) * 1000,
    ignitionOffSince: null,
  };

  const step = (time, dt) => {
    if (path.length === 0) {
      state.speed = 0;
    } else if (state.pause > 0) {
      state.pause -= dt;
      state.speed = 0;
    } else if (state.stop > 0) {
      state.stop -= dt;
      state.speed = Math.max(0, state.speed - 25 * dt);
    } else {
      if (rand() < 0.025 * (dt / 10)) state.stop = 15 + rand() * 45; // traffic light / jam
      const target = vehicle.maxKmh * (0.55 + rand() * 0.45);
      state.speed += Math.max(-20, Math.min(12, target - state.speed)) * Math.min(1, dt / 10);
      state.offset += state.direction * (state.speed / 3.6) * dt;
      state.odometer += (state.speed / 3.6) * dt;
      if (state.offset >= path.length || state.offset <= 0) {
        state.offset = Math.min(path.length, Math.max(0, state.offset));
        state.direction *= -1;
        state.pause = 120 + rand() * 240; // delivery stop with engine off
        state.speed = 0;
      }
      state.fuel = Math.max(5, state.fuel - (state.speed / 3.6) * dt * 0.00004);
    }

    const moving = state.speed > 2;
    const ignition = path.length > 0 && (moving || state.stop > 0);
    if (vehicle.category === 'motorcycle' || vehicle.battery !== undefined) {
      state.battery = Math.max(8, state.battery - dt * 0.0006);
    }

    const { coordinate, course } =
      path.length > 0 ? pointAt(path, state.offset) : { coordinate: path.line[0], course: 0 };
    const heading = state.direction > 0 ? course : (course + 180) % 360;

    const attributes = {
      ignition,
      motion: moving,
      power: (ignition ? 14.1 + rand() * 0.3 : 12.4 + rand() * 0.3).toFixed(1),
      totalDistance: Math.round(state.odometer),
    };
    if (vehicle.fuel) attributes.fuelLevel = state.fuel.toFixed(1);
    if (vehicle.battery !== undefined || vehicle.category === 'motorcycle') {
      attributes.batt = Math.round(state.battery);
    }
    if (driverId && ignition) attributes.driverUniqueId = driverId;

    return {
      latitude: coordinate[1],
      longitude: coordinate[0],
      speedKmh: moving ? state.speed : 0,
      course: heading,
      attributes,
      time,
    };
  };

  return { step };
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

const simulate = async () => {
  const devices = await listAll('devices');
  const missing = vehicles.filter(
    (vehicle) => !devices.some((it) => it.uniqueId === PREFIX + vehicle.id),
  );
  if (missing.length) {
    throw new Error(
      `Demo devices missing (${missing.map((it) => it.id).join(', ')}). Run "seed" first.`,
    );
  }

  console.log('Preparing routes...');
  const now = Date.now();
  const historyStart = now - historyHours * 3600 * 1000;
  const fleet = [];
  for (const [index, vehicle] of vehicles.entries()) {
    if (vehicle.mode === 'never') continue;
    const line = await roadGeometry(vehicle.route);
    const path = vehicle.mode ? { line, cumulative: [0], length: 0 } : buildPath(line);
    fleet.push({
      vehicle,
      uniqueId: PREFIX + vehicle.id,
      sim: createSimulator(vehicle, path, index),
    });
  }

  // Offline vehicle: a single report from earlier today, then silence.
  for (const item of fleet.filter((it) => it.vehicle.mode === 'offline')) {
    await sendPosition(item.uniqueId, item.sim.step(now - 5 * 3600 * 1000, 10));
  }

  const live = fleet.filter((it) => it.vehicle.mode !== 'offline');

  if (historyHours > 0) {
    const historyStep = 30;
    const tasks = [];
    for (const item of live) {
      const points = [];
      for (let time = historyStart; time < now; time += historyStep * 1000) {
        points.push(item.sim.step(time, historyStep));
      }
      tasks.push(async () => {
        for (const point of points) await sendPosition(item.uniqueId, point);
      });
    }
    const total = live.length * Math.ceil((now - historyStart) / (historyStep * 1000));
    console.log(`Backfilling ${historyHours}h of history (${total} positions)...`);
    await runLimited(tasks, live.length);
  }

  console.log(`Live simulation every ${intervalSeconds}s via ${osmandUrl} (Ctrl+C to stop)`);
  let last = Date.now();
  let ticks = 0;
  const tick = async () => {
    const time = Date.now();
    const dt = (time - last) / 1000;
    last = time;
    const results = await Promise.allSettled(
      live.map((item) => sendPosition(item.uniqueId, item.sim.step(time, dt))),
    );
    const failed = results.filter((it) => it.status === 'rejected');
    ticks += 1;
    if (failed.length) {
      console.warn(`  ${failed.length} updates failed: ${failed[0].reason.message}`);
    } else if (ticks % 30 === 1) {
      console.log(`  ${new Date(time).toLocaleTimeString()} sent ${live.length} positions`);
    }
  };
  await tick();
  setInterval(tick, intervalSeconds * 1000);
};

// ---------------------------------------------------------------------------

try {
  if (command === 'clean') {
    await clean();
  } else {
    if (command === 'run' || command === 'seed') await seed();
    if (command === 'run' || command === 'simulate') await simulate();
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  if (error.cause) console.error(error.cause);
  process.exit(1);
}

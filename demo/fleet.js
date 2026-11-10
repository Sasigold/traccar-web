import route from './route.js';

const interval = 5000;
const retention = 20 * 60 * 1000;

// YYYY-MM-DD, `days` from `now` (local date).
const dateFrom = (now, days) => {
  const date = new Date(now + days * 86400000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Roadmap stage 0 vehicle details: one expired, one expiring, the rest valid.
const vehicleDetails = (now) => [
  {
    plateNumber: '12-345-67',
    make: 'Ford',
    vehicleModel: 'Transit',
    modelYear: 2022,
    fuelType: 'diesel',
    ownership: 'leased',
    testExpiry: dateFrom(now, 140),
    insuranceCompulsoryExpiry: dateFrom(now, -4),
    insuranceComprehensiveExpiry: dateFrom(now, 200),
    leaseEndDate: dateFrom(now, 420),
  },
  {
    plateNumber: '234-56-789',
    make: 'Renault',
    vehicleModel: 'Kangoo',
    modelYear: 2021,
    fuelType: 'diesel',
    ownership: 'owned',
    testExpiry: dateFrom(now, 12),
    insuranceCompulsoryExpiry: dateFrom(now, 95),
  },
  {
    plateNumber: '345-67-890',
    make: 'Toyota',
    vehicleModel: 'Proace',
    modelYear: 2023,
    fuelType: 'hybrid',
    ownership: 'leased',
    testExpiry: dateFrom(now, 260),
    insuranceCompulsoryExpiry: dateFrom(now, 75),
    leaseEndDate: dateFrom(now, 25),
  },
  {
    plateNumber: '45-678-90',
    make: 'Skoda',
    vehicleModel: 'Octavia',
    modelYear: 2020,
    fuelType: 'petrol',
    ownership: 'owned',
    testExpiry: dateFrom(now, 300),
    insuranceCompulsoryExpiry: dateFrom(now, 180),
  },
  {
    plateNumber: '567-89-012',
    make: 'Hyundai',
    vehicleModel: 'Ioniq 5',
    modelYear: 2024,
    fuelType: 'electric',
    ownership: 'rented',
    testExpiry: dateFrom(now, 500),
  },
  {
    plateNumber: '678-90-123',
    make: 'Volvo',
    vehicleModel: 'FL',
    modelYear: 2019,
    fuelType: 'diesel',
    ownership: 'owned',
    testExpiry: dateFrom(now, 60),
    insuranceCompulsoryExpiry: dateFrom(now, 60),
  },
];

export const createDrivers = (now = Date.now()) => [
  {
    id: 1,
    name: 'דנה לוי',
    uniqueId: '0A1B2C3D',
    attributes: {
      phone: '050-1234567',
      licenseNumber: '7654321',
      licenseClasses: ['B', 'C1'],
      licenseExpiry: dateFrom(now, 18),
      driverStatus: 'active',
      hireDate: '2021-03-01',
    },
  },
  {
    id: 2,
    name: 'Yossi Cohen',
    uniqueId: '1B2C3D4E',
    attributes: {
      phone: '052-7654321',
      licenseNumber: '1234567',
      licenseClasses: ['B', 'C', 'C+E'],
      licenseExpiry: dateFrom(now, -10),
      driverStatus: 'active',
    },
  },
  {
    id: 3,
    name: 'Noa Mizrahi',
    uniqueId: '2C3D4E5F',
    attributes: {
      licenseClasses: ['B'],
      // ISR-12: a new driver, still with the night escort.
      licenseIssued: dateFrom(now, -120),
      licenseExpiry: dateFrom(now, 700),
      driverStatus: 'active',
    },
  },
];

// Distance maintenance in meters, linked to every vehicle except the electric one.
export const createMaintenance = () => [
  {
    id: 1,
    name: 'Oil service',
    type: 'totalDistance',
    start: 15000 * 1000,
    period: 15000 * 1000,
    attributes: {},
  },
];

export const maintenanceFor = (deviceId) => (Number(deviceId) === 5 ? [] : createMaintenance());

// `size` (FND-07): the performance profile asks for a fleet of 2,000. The extra vehicles are
// plain ones spread along the route, a fifth of them offline; their history is kept for a
// minute only, so the server's memory stays small.
export const createFleet = (now = Date.now(), { size = 0 } = {}) => {
  const details = vehicleDetails(now);
  const anchor = Math.floor(now / interval) * interval;
  const base = ['Delivery Van', 'Service Van', 'City Shuttle', 'Courier', 'Support Car', 'בדיקה'];
  const names = [
    ...base,
    ...Array.from(
      { length: Math.max(0, size - base.length) },
      (_, i) => `רכב ${i + base.length + 1}`,
    ),
  ];
  const keep = size > base.length ? 60 * 1000 : retention;
  const testDeviceId = base.length;
  const devices = names.map((name, index) => ({
    id: index + 1,
    name,
    uniqueId: `demo-${index + 1}`,
    status: index >= base.length && index % 5 === 0 ? 'offline' : 'online',
    category:
      index + 1 === testDeviceId
        ? 'truck'
        : index < base.length
          ? 'car'
          : ['car', 'van', 'truck', 'pickup'][index % 4],
    disabled: false,
    // Two demo groups: north (1) and center (2).
    groupId: index < 3 ? 1 : 2,
    // The test device has a tank capacity (liters) and a speed limit (knots).
    attributes: {
      ...(details[index] || {
        plateNumber: `${String(10 + (index % 90)).padStart(2, '0')}-${String(100 + (index % 900))}-${String(10 + (index % 89))}`,
      }),
      ...(index + 1 === testDeviceId && { fuelCapacity: 80, speedLimit: 27 }),
    },
  }));

  // A device that reports a rich set of parameters, to exercise the dashboard.
  const testAttributes = (step, speed, moving) => {
    const wave = (period, phase = 0) => Math.sin((step / period) * 2 * Math.PI + phase);
    return {
      fuel: 46 + 14 * wave(90),
      rpm: moving ? Math.round(1800 + speed * 55 + 300 * wave(7)) : 780,
      coolantTemp: 88 + 6 * wave(40),
      engineLoad: moving ? 38 + 20 * wave(11) : 12,
      throttle: moving ? 30 + 25 * wave(9, 1) : 0,
      fuelConsumption: moving ? 9.4 + 2 * wave(13) : 0.8,
      hours: 5_420_000_000 + step * 5000,
      batteryLevel: 78 + 4 * wave(120),
      battery: 4.05 + 0.08 * wave(60),
      sat: 9 + Math.round(3 * wave(30)),
      satVisible: 16,
      rssi: 4,
      hdop: 0.9,
      operator: 'IL-01 Partner',
      temp1: 4.2 + 1.5 * wave(50),
      temp2: -18.4 + 0.6 * wave(70),
      humidity: 52 + 8 * wave(80),
      door: !moving && step % 4 === 0,
      lock: moving,
      blocked: false,
      armed: !moving,
      charge: true,
      in1: true,
      out1: false,
      tripOdometer: 18_400 + step * 12,
      drivingTime: 4_200_000 + step * 5000,
      driverUniqueId: '1B2C3D4E',
      iccid: '8997201234567890123',
      versionFw: '3.7.12',
      vin: '4V4NC9EH5GN123456',
      event: 239,
      axleWeight: 7400,
      // Tire pressure in kPa, the way TPMS sensors usually report it.
      tirePressure1: 241 + 3 * wave(25),
      tirePressure2: 238 + 3 * wave(27, 1),
      tirePressure3: 196 - 2 * wave(31),
      tirePressure4: 244 + 3 * wave(29, 2),
    };
  };
  let lastTick = -1;
  let history = [];
  let positions = [];

  const sample = (timestamp) =>
    devices.map((device, index) => {
      const step =
        (timestamp - anchor) / interval + Math.floor((index * route.length) / devices.length);
      const routeIndex = ((step % route.length) + route.length) % route.length;
      const [longitude, latitude, speed, course] = route[routeIndex];
      const moving = speed > 0;
      const time = new Date(timestamp).toISOString();
      return {
        id: (timestamp / interval) * 10 + device.id,
        deviceId: device.id,
        protocol: 'demo',
        serverTime: time,
        deviceTime: time,
        fixTime: time,
        valid: true,
        outdated: false,
        latitude,
        longitude,
        address: 'Central London, UK',
        speed,
        course,
        attributes: {
          batteryLevel: Math.max(5, 95 - (index % 6) * 15),
          fuel: Math.max(3, 45 - (index % 6) * 7),
          // The third vehicle keeps its engine running at stops, so the demo shows idling.
          ignition: moving || index === 2,
          motion: moving,
          power: moving ? 14.2 : 12.6,
          totalDistance: (12000 + (index % 50) * 8000) * 1000,
          ...(index === 1 && { dtcs: 'P0171,P0420' }),
          // A driver identified by tag, so the card can show and call them.
          ...(index === 0 && { driverUniqueId: '0A1B2C3D' }),
          ...(device.id === testDeviceId && testAttributes(step, speed, moving)),
        },
      };
    });

  const advance = (time = Date.now()) => {
    const tick = Math.floor(time / interval) * interval;
    if (tick <= lastTick) return;
    const from = lastTick < 0 ? tick - keep : Math.max(lastTick + interval, tick - keep);
    for (let timestamp = from; timestamp <= tick; timestamp += interval) {
      positions = sample(timestamp);
      history.push(...positions);
      // Traccar keeps motionState / motionTime on the device: when the current state began.
      positions.forEach((position, index) => {
        const device = devices[index];
        if (device.motionState !== position.attributes.motion) {
          device.motionState = position.attributes.motion;
          device.motionTime = position.fixTime;
        }
      });
    }
    lastTick = tick;
    history = history.filter((position) => Date.parse(position.fixTime) >= tick - keep);
    devices.forEach((device, index) => {
      device.positionId = positions[index].id;
      device.lastUpdate = positions[index].fixTime;
    });
  };
  advance(now);
  return {
    advance,
    devices,
    get positions() {
      return positions;
    },
    query: (params) => {
      const ids = params.getAll('id').map(Number);
      if (ids.length) return history.filter((position) => ids.includes(position.id));
      const deviceIds = params.getAll('deviceId').map(Number);
      const hasRange = params.has('from') && params.has('to');
      const from = params.has('from') ? Date.parse(params.get('from')) : -Infinity;
      const to = params.has('to') ? Date.parse(params.get('to')) : Infinity;
      const source = hasRange ? history : positions;
      return source.filter(
        (position) =>
          (!deviceIds.length || deviceIds.includes(position.deviceId)) &&
          Date.parse(position.fixTime) >= from &&
          Date.parse(position.fixTime) <= to,
      );
    },
  };
};

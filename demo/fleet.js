import route from './route.js';

const interval = 5000;
const retention = 20 * 60 * 1000;

export const createFleet = (now = Date.now()) => {
  const anchor = Math.floor(now / interval) * interval;
  const names = ['Delivery Van', 'Service Van', 'City Shuttle', 'Courier', 'Support Car', 'בדיקה'];
  const testDeviceId = names.length;
  const devices = names.map((name, index) => ({
    id: index + 1,
    name,
    uniqueId: `demo-${index + 1}`,
    status: 'online',
    category: index + 1 === testDeviceId ? 'truck' : 'car',
    disabled: false,
    groupId: 0,
    // The test device has a tank capacity (liters) and a speed limit (knots).
    attributes: index + 1 === testDeviceId ? { fuelCapacity: 80, speedLimit: 27 } : {},
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
      driverUniqueId: 'D-1024',
      iccid: '8997201234567890123',
      versionFw: '3.7.12',
      vin: '4V4NC9EH5GN123456',
      event: 239,
      axleWeight: 7400,
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
          batteryLevel: 95 - index * 15,
          fuel: 45 - index * 7,
          ignition: moving,
          motion: moving,
          power: moving ? 14.2 : 12.6,
          totalDistance: (12000 + index * 8000) * 1000,
          ...(device.id === testDeviceId && testAttributes(step, speed, moving)),
        },
      };
    });

  const advance = (time = Date.now()) => {
    const tick = Math.floor(time / interval) * interval;
    if (tick <= lastTick) return;
    const from = lastTick < 0 ? tick - retention : Math.max(lastTick + interval, tick - retention);
    for (let timestamp = from; timestamp <= tick; timestamp += interval) {
      positions = sample(timestamp);
      history.push(...positions);
    }
    lastTick = tick;
    history = history.filter((position) => Date.parse(position.fixTime) >= tick - retention);
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

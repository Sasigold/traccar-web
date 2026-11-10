import { describe, expect, it } from 'vitest';
import { costPerKmByVehicle, deviceHealth, usageByVehicle } from '../fleetReports';

const devices = [
  { id: 1, name: 'Van', lastUpdate: '2026-11-10T07:00:00Z' },
  { id: 2, name: 'Truck', lastUpdate: '2026-11-08T07:00:00Z' },
];
const HOUR = 3600000;

describe('usage report', () => {
  const trips = [
    // Tuesday 10:00 Israel time: working hours.
    { deviceId: 1, startTime: '2026-11-10T08:00:00Z', distance: 10000, duration: HOUR },
    // Tuesday 22:00: after hours.
    { deviceId: 1, startTime: '2026-11-10T20:00:00Z', distance: 5000, duration: HOUR / 2 },
    // Saturday: a rest day.
    { deviceId: 1, startTime: '2026-11-14T08:00:00Z', distance: 3000, duration: HOUR / 4 },
  ];
  const stops = [{ deviceId: 1, engineHours: 2 * HOUR }];

  it('splits distance by when it was driven and prices the idling', () => {
    const [van, truck] = usageByVehicle(devices, trips, stops, {
      days: 7,
      idleBurn: 0.8,
      fuelPrice: 7,
      periods: [
        {
          traccar_device_id: 1,
          started_at: '2026-11-10T19:00:00Z',
          ended_at: '2026-11-10T23:00:00Z',
        },
      ],
    });
    expect(van).toMatchObject({
      distance: 18000,
      activeDays: 2,
      afterHoursDistance: 5000,
      restDayDistance: 3000,
      privateDistance: 5000,
      idleTime: 2 * HOUR,
    });
    expect(van.utilization).toBeCloseTo(28.57, 1);
    expect(van.idleCost).toBeCloseTo(11.2);
    expect(truck).toMatchObject({ distance: 0, activeDays: 0, idleCost: 0 });
  });

  it('has no idle cost without a fuel price', () => {
    const [van] = usageByVehicle(devices, trips, stops, { days: 7, idleBurn: 0.8 });
    expect(van.idleCost).toBeNull();
  });
});

describe('cost per km', () => {
  it('divides the costs by the distance', () => {
    const [van, truck] = costPerKmByVehicle(
      devices,
      [{ deviceId: 1, distance: 1_000_000 }],
      [
        { deviceId: 1, category: 'fuel', amount: 700 },
        { deviceId: 1, category: 'maintenance', amount: 250 },
        { deviceId: 1, category: 'insurance', amount: 50 },
        { deviceId: 2, category: 'fuel', amount: 100 },
      ],
    );
    expect(van).toMatchObject({ fuel: 700, maintenance: 250, other: 50, total: 1000, perKm: 1 });
    expect(truck.perKm).toBeNull(); // costs but no distance
  });
});

describe('device health', () => {
  it('puts silent devices, power cuts and fault codes first', () => {
    const rows = deviceHealth(
      devices,
      { 1: { attributes: { dtcs: 'P0300, P0171' } } },
      [{ deviceId: 1, type: 'alarm', attributes: { alarm: 'powerCut' } }],
      Date.parse('2026-11-10T08:00:00Z'),
    );
    expect(rows[0]).toMatchObject({
      name: 'Van',
      powerCuts: 1,
      dtcs: ['P0300', 'P0171'],
      silent: false,
    });
    expect(rows[1]).toMatchObject({ name: 'Truck', silent: true });
    expect(rows[1].silentHours).toBe(49);
  });
});

describe('a smaller fleet (OPS-04)', () => {
  it('lists the least used vehicles under 20%, and the saving of returning one', async () => {
    const { underusedVehicles } = await import('../fleetReports');
    const rows = [
      { name: 'א', utilization: 10 },
      { name: 'ב', utilization: 80 },
      { name: 'ג', utilization: 5 },
      { name: 'ד', utilization: null },
    ];
    const result = underusedVehicles(rows, { monthlyCost: 3200 });
    expect(result.vehicles.map((row) => row.name)).toEqual(['ג', 'א']);
    expect(result.savings).toBe(3200);
    expect(underusedVehicles(rows).savings).toBeNull();
    expect(underusedVehicles([{ utilization: 90 }]).vehicles).toEqual([]);
  });
});

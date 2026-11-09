import { distanceMeters } from '../../map/core/motion';

// OPS-02: fuel fraud and theft checks, and idle in shekels. Pure, unit-tested.
//
// Each check is a switch the organization can turn off. The first two look at where the vehicle
// was when the card was used; the others come from the fuel company's file (over the tank,
// wrong fuel, too frequent) and from Traccar's fuel-drop events while parked with the engine off.

export const FUEL_RULES = ['notAtVehicle', 'overCapacity', 'wrongFuel', 'tooFrequent', 'fuelDrop'];

// The import flags each file rule writes (fuelImport.js).
export const RULE_FLAGS = {
  overCapacity: 'over_capacity',
  wrongFuel: 'wrong_fuel',
  tooFrequent: 'too_frequent',
};

export const rulesOn = (stored) =>
  Object.fromEntries(FUEL_RULES.map((rule) => [rule, stored?.[rule] !== false]));

const NEAR_MS = 20 * 60000;
const FAR_METERS = 1000;
const time = (value) => Date.parse(value);

// Where the vehicle was when the card was used: a stop that covers the time (give or take 20
// minutes). No stop: the vehicle was driving. A stop far from the station's own coordinates
// (when the file has them): somewhere else.
export const locationFinding = (tx, stops) => {
  const at = time(tx.occurred_at);
  const stop = stops.find(
    (item) => time(item.startTime) - NEAR_MS <= at && at <= time(item.endTime) + NEAR_MS,
  );
  if (!stop) {
    return { rule: 'notAtVehicle', reason: 'moving' };
  }
  if (tx.latitude != null && tx.longitude != null && stop.latitude != null) {
    const meters = distanceMeters(
      { latitude: stop.latitude, longitude: stop.longitude },
      { latitude: tx.latitude, longitude: tx.longitude },
    );
    if (meters > FAR_METERS) {
      return { rule: 'notAtVehicle', reason: 'far', km: Math.round(meters / 100) / 10, stop };
    }
  }
  return null;
};

// Traccar's fuel-drop events while the engine was off: fuel left a parked vehicle.
export const parkedDrops = (events, positionsById) =>
  events
    .filter((event) => event.type === 'deviceFuelDrop')
    .filter((event) => positionsById[event.positionId]?.attributes?.ignition === false)
    .map((event) => ({
      rule: 'fuelDrop',
      deviceId: event.deviceId,
      time: event.eventTime,
      position: positionsById[event.positionId],
    }));

// Idle: engine hours that were not driving, per vehicle, in liters and shekels.
export const idleCost = ({ summaries, trips, price, litersPerHour }) => {
  const driving = new Map();
  trips.forEach((trip) => {
    driving.set(trip.deviceId, (driving.get(trip.deviceId) || 0) + (trip.duration || 0));
  });
  const rows = summaries.map((summary) => {
    const hours =
      Math.max(0, (summary.engineHours || 0) - (driving.get(summary.deviceId) || 0)) / 3600000;
    const liters = hours * litersPerHour;
    return {
      deviceId: summary.deviceId,
      hours: Math.round(hours * 10) / 10,
      liters: Math.round(liters * 10) / 10,
      cost: price ? Math.round(liters * price) : null,
    };
  });
  return {
    rows: rows.filter((row) => row.hours > 0).sort((a, b) => b.hours - a.hours),
    total: price ? rows.reduce((sum, row) => sum + (row.cost || 0), 0) : null,
    hours: Math.round(rows.reduce((sum, row) => sum + row.hours, 0) * 10) / 10,
  };
};

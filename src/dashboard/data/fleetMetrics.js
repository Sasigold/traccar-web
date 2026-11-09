// Fleet metrics the dashboard computes from report rows (REP-06). Pure, unit-tested.
import { DEFAULT_POLICY, inPrivatePeriod, isWorkTime } from '../../common/fleet/privacy';

// Kilograms of CO2 per liter burnt. Electric vehicles emit none on the road; for other fuels
// (gas) the figure is not known here, so they are left out rather than guessed.
export const CO2_PER_LITER = { petrol: 2.31, diesel: 2.68, hybrid: 2.31, electric: 0 };

export const co2Kg = (liters, fuelType) => {
  const factor = CO2_PER_LITER[fuelType];
  const value = Number(liters);
  return factor == null || !Number.isFinite(value) || value <= 0 ? null : value * factor;
};

// A trip that starts outside the organization's working hours (Sunday to Thursday, 07–19 by default).
export const afterHours = (policy, time) => !isWorkTime(policy || DEFAULT_POLICY, time);

// A trip driven while its driver had private mode on.
export const privateTrip = (periods, trip) =>
  inPrivatePeriod(periods, trip.deviceId, trip.startTime);

// Share of vehicle-days with any driving: distinct (vehicle, day) pairs over vehicles × days.
export const activeDaysPct = (trips, vehicleCount, days) => {
  if (!vehicleCount || !days) {
    return null;
  }
  const pairs = new Set(
    trips
      .filter((trip) => Number(trip.distance) > 0)
      .map((trip) => `${trip.deviceId}|${String(trip.startTime).slice(0, 10)}`),
  );
  return (100 * pairs.size) / (vehicleCount * days);
};

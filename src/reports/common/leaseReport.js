import { leaseForecast } from '../../common/fleet/lease';

// REP-23: a period's kilometers against the lease quota, per leased vehicle. Pure, unit-tested.

const toTime = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : NaN;
};

// The share of the contract's quota that falls in the period (meters), or null.
/** @param {Record<string, any>} attributes @param {string} from @param {string} to */
export const leaseAllowance = (attributes, from, to) => {
  const start = toTime(attributes?.leaseStartDate);
  const end = toTime(attributes?.leaseEndDate);
  const quota = Number(attributes?.leaseKmQuota);
  if (!(end > start) || !(quota > 0)) return null;
  const overlap = Math.min(end, Date.parse(to)) - Math.max(start, Date.parse(from));
  if (!(overlap > 0)) return null;
  return Math.round((quota * 1000 * overlap) / (end - start));
};

/**
 * @param {any[]} devices the vehicles in scope
 * @param {{ deviceId: number, distance?: number }[]} summary the period's summary
 * @param {(deviceId: number) => number | null} odometerOf today's odometer in km
 * @param {string} from @param {string} to
 * @param {Date} [now]
 */
export const leaseRows = (devices, summary, odometerOf, from, to, now = new Date()) =>
  devices
    .filter((device) => device.attributes?.ownership === 'leased')
    .map((device) => {
      const attributes = device.attributes;
      const distance = (summary || [])
        .filter((row) => row.deviceId === device.id)
        .reduce((total, row) => total + (row.distance || 0), 0);
      const allowance = leaseAllowance(attributes, from, to);
      const forecast = leaseForecast(attributes, odometerOf(device.id), now);
      return {
        deviceId: device.id,
        name: device.name,
        distance,
        allowance,
        allowanceShare: allowance ? Math.round((distance / allowance) * 100) : null,
        used: forecast ? forecast.used * 1000 : null,
        quota: Number(attributes.leaseKmQuota) > 0 ? Number(attributes.leaseKmQuota) * 1000 : null,
        projected: forecast?.projected != null ? forecast.projected * 1000 : null,
        excess: forecast?.excessKm ? forecast.excessKm * 1000 : 0,
        excessCost: forecast?.excessCost ?? null,
      };
    });

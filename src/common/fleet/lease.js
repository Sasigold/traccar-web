// ADM-31: a lease contract's kilometers. From the start and end dates, the odometer when it
// started, the quota for the whole contract and today's odometer: how far it went, where the
// current pace ends, and what the kilometers over the quota would cost. Pure, unit-tested.

const DAY = 86400000;

// `YYYY-MM-DD` as a local date.
const toDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

/**
 * @param {Record<string, any>} attributes the vehicle's leaseStartDate, leaseEndDate,
 *   leaseStartKm, leaseKmQuota and leaseExcessRate
 * @param {number | null} currentKm today's odometer
 * @param {Date} [now]
 */
export const leaseForecast = (attributes, currentKm, now = new Date()) => {
  const start = toDate(attributes?.leaseStartDate);
  const end = toDate(attributes?.leaseEndDate);
  const quota = Number(attributes?.leaseKmQuota);
  if (!start || !end || end <= start || !(quota > 0) || !Number.isFinite(currentKm)) return null;
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total);
  const used = Math.max(0, Math.round(currentKm - (Number(attributes.leaseStartKm) || 0)));
  // The first two weeks say little about the pace.
  const projected = elapsed >= 14 * DAY ? Math.round((used * total) / elapsed) : null;
  const excessKm = Math.max(0, (projected ?? used) - quota);
  const rate = Number(attributes.leaseExcessRate);
  return {
    used,
    quota,
    share: Math.min(1, used / quota),
    // Where the quota says it should be by now.
    expected: Math.round((quota * elapsed) / total),
    projected,
    excessKm,
    excessCost: excessKm > 0 && rate > 0 ? Math.round(excessKm * rate) : null,
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY)),
  };
};

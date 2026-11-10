// ISR-12: a "new driver" (נהג חדש) from the date the license was issued.
//
// The periods below follow the Israeli rules as the roadmap describes them: two years as a new
// driver, an escort for the first three months (daytime) and six months (night). They are kept
// here, in one place, so the owner can check them against the current regulations and change a
// number without touching the screens.
export const NEW_DRIVER_RULES = {
  newDriverMonths: 24,
  escortDayMonths: 3,
  escortNightMonths: 6,
};

const parse = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const ymd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// null when the driver is not new (or the date is unknown or in the future); otherwise when the
// period ends and whether an escort is still required by day or at night.
export const newDriverStatus = (issued, now = new Date(), rules = NEW_DRIVER_RULES) => {
  const start = parse(issued);
  if (!start || start > now) return null;
  const until = addMonths(start, rules.newDriverMonths);
  if (now >= until) return null;
  const escortDayUntil = addMonths(start, rules.escortDayMonths);
  const escortNightUntil = addMonths(start, rules.escortNightMonths);
  return {
    until: ymd(until),
    escortDay: now < escortDayUntil,
    escortNight: now < escortNightUntil,
    escortUntil: now < escortNightUntil ? ymd(escortNightUntil) : null,
  };
};

// A warning when a new driver is assigned to a vehicle the fleet marked as not for new drivers.
export const newDriverConflict = (driverAttributes, vehicleAttributes, now = new Date()) =>
  Boolean(vehicleAttributes?.noNewDrivers) &&
  Boolean(newDriverStatus(driverAttributes?.licenseIssued, now));

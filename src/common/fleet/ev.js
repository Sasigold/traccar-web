// OPS-09: electric vehicles: charging sessions found in the battery level, what they cost, the
// range left, and which vehicles could move to electric by the driving they actually do.
// Pure, tested.

// The battery level of a position in percent (Traccar's batteryLevel, or the EV attributes some
// trackers send).
export const batteryPercent = (position) => {
  const attributes = position?.attributes || {};
  const value = attributes.batteryLevel ?? attributes.evBatteryLevel ?? attributes.soc;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
};

// Charging sessions: the battery rises by at least `minGain` points while the vehicle stands
// (speed under 2 knots). history: positions in any order. Each session: { start, end, from, to }.
export const chargingSessions = (history, { minGain = 5 } = {}) => {
  const points = history
    .map((position) => ({
      time: new Date(position.fixTime).getTime(),
      level: batteryPercent(position),
      moving: Number(position.speed) >= 2,
    }))
    .filter((point) => Number.isFinite(point.time) && point.level != null)
    .sort((a, b) => a.time - b.time);
  const sessions = [];
  /** @type {{ start: number, end?: number, from: number, to?: number } | null} */
  let current = null;
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const rising = previous && !point.moving && point.level > previous.level;
    if (rising) {
      if (!current) current = { start: previous.time, from: previous.level };
      current.end = point.time;
      current.to = point.level;
    } else if (current && (point.moving || point.level < current.to)) {
      if (current.to - current.from >= minGain) sessions.push(current);
      current = null;
    }
  });
  if (current && current.to - current.from >= minGain) sessions.push(current);
  return sessions.map((session) => ({
    start: new Date(session.start).toISOString(),
    end: new Date(session.end).toISOString(),
    from: session.from,
    to: session.to,
  }));
};

// kWh a session put in, and its cost at a price per kWh (₪).
export const sessionEnergy = (session, capacityKwh) =>
  capacityKwh > 0 ? ((session.to - session.from) / 100) * capacityKwh : null;

export const sessionCost = (session, capacityKwh, pricePerKwh) => {
  const energy = sessionEnergy(session, capacityKwh);
  return energy != null && pricePerKwh > 0 ? energy * pricePerKwh : null;
};

// Km left at this level, with a margin (default 10% kept in reserve).
export const rangeKm = (percent, capacityKwh, kwhPer100Km, reserve = 0.1) => {
  if (!(capacityKwh > 0) || !(kwhPer100Km > 0) || percent == null) return null;
  const usable = Math.max(0, percent / 100 - reserve) * capacityKwh;
  return Math.round((usable / kwhPer100Km) * 100);
};

// Whether tomorrow's planned km fit in the charge there is now.
export const enoughFor = (plannedKm, percent, capacityKwh, kwhPer100Km) => {
  const range = rangeKm(percent, capacityKwh, kwhPer100Km);
  return range == null || plannedKm == null ? null : range >= plannedKm;
};

// Could this vehicle be electric? Its daily km (one number per driven day) against a realistic
// range: it fits when at least `share` of the days (default 95%) are within it.
export const evFit = (dailyKm, realisticRangeKm = 250, share = 0.95) => {
  const days = dailyKm.filter((km) => km > 0);
  if (days.length < 5) return { fits: null, days: days.length };
  const within = days.filter((km) => km <= realisticRangeKm).length;
  return {
    fits: within / days.length >= share,
    days: days.length,
    within,
    longest: Math.max(...days),
  };
};

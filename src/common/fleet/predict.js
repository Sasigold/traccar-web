// AI-06: early warnings from the data the devices already send (no model needed).

// A 12V battery that sags when the engine cranks: the lowest voltage in the seconds around each
// ignition-on, over the last starts. Healthy: above ~10.5V at crank and ~12.4V at rest.
export const CRANK_WEAK = 9.6;
export const CRANK_WATCH = 10.2;

// positions: [{ fixTime, attributes: { ignition, power } }] sorted by time.
export const crankVoltages = (positions, windowMs = 30000) => {
  const result = [];
  for (let i = 1; i < positions.length; i += 1) {
    const before = positions[i - 1].attributes || {};
    const now = positions[i].attributes || {};
    if (!before.ignition && now.ignition) {
      const start = Date.parse(positions[i].fixTime);
      const around = positions.filter((p) => {
        const time = Date.parse(p.fixTime);
        return (
          time >= start - windowMs && time <= start + windowMs && Number(p.attributes?.power) > 0
        );
      });
      if (around.length) {
        result.push({
          time: positions[i].fixTime,
          volts: Math.min(...around.map((p) => Number(p.attributes.power))),
        });
      }
    }
  }
  return result;
};

// The battery's state from its last starts: weak when the median crank dips below 9.6V, to watch
// below 10.2V or when it keeps falling.
export const batteryHealth = (cranks) => {
  if (cranks.length < 3) return { state: 'unknown' };
  const recent = cranks
    .slice(-7)
    .map((c) => c.volts)
    .sort((a, b) => a - b);
  const median = recent[Math.floor(recent.length / 2)];
  const first = cranks.slice(0, 3).reduce((s, c) => s + c.volts, 0) / 3;
  const last = cranks.slice(-3).reduce((s, c) => s + c.volts, 0) / 3;
  const falling = first - last >= 0.5;
  if (median < CRANK_WEAK) return { state: 'weak', median };
  if (median < CRANK_WATCH || falling) return { state: 'watch', median, falling };
  return { state: 'ok', median };
};

// The same fault code in several vehicles of one model: a fleet pattern, not bad luck.
// codes: [{ deviceId, code, model }]
export const repeatedFaults = (codes, minVehicles = 3) => {
  const groups = new Map();
  codes.forEach(({ deviceId, code, model }) => {
    if (!code || !model) return;
    const key = `${model}|${code}`;
    if (!groups.has(key)) groups.set(key, { model, code, devices: new Set() });
    groups.get(key).devices.add(deviceId);
  });
  return [...groups.values()]
    .filter((group) => group.devices.size >= minVehicles)
    .map((group) => ({
      model: group.model,
      code: group.code,
      count: group.devices.size,
      deviceIds: [...group.devices],
    }))
    .sort((a, b) => b.count - a.count);
};

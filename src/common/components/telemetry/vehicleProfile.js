// Per-vehicle display profile: how the dashboard reads fuel and tire pressure,
// and per-parameter tweaks (name, scale, unit, visibility). Stored on the device
// as a JSON string in the `web.vehicle` attribute; the tank capacity keeps using
// Traccar's standard `fuelCapacity` attribute (liters).

export const PROFILE_KEY = 'web.vehicle';

export const wheels = ['fl', 'fr', 'rl', 'rr'];

export const pressureUnits = ['bar', 'psi', 'kpa'];

const toBar = { bar: 1, psi: 1 / 14.5038, kpa: 0.01 };

export const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export const convertPressure = (value, from, to) => (value * toBar[from]) / toBar[to];

export const pressureDigits = (unit) => (unit === 'bar' ? 1 : 0);

export const parseProfile = (device) => {
  const raw = device?.attributes?.[PROFILE_KEY];
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const clean = (object) =>
  Object.fromEntries(
    Object.entries(object || {}).filter(
      ([, value]) => value != null && value !== '' && !Number.isNaN(value),
    ),
  );

// Drops empty settings so the stored attribute stays small and readable.
export const compactProfile = (profile) => {
  const fuel = clean(profile.fuel);
  if (fuel.unit === 'auto') delete fuel.unit;
  const tires = clean(profile.tires);
  const tireWheels = clean(tires.wheels);
  if (Object.keys(tireWheels).length) tires.wheels = tireWheels;
  else delete tires.wheels;
  if (tires.show === 'auto') delete tires.show;
  if (tires.input === 'auto') delete tires.input;
  const params = Object.fromEntries(
    Object.entries(profile.params || {})
      .map(([key, value]) => {
        const config = clean(value);
        if (config.factor === 1) delete config.factor;
        if (config.offset === 0) delete config.offset;
        if (config.hidden === false) delete config.hidden;
        return [key, config];
      })
      .filter(([, value]) => Object.keys(value).length),
  );
  // `sensors` is the list made in the super admin device setup (src/admin/sensors.js).
  const sensors = Array.isArray(profile.sensors) && profile.sensors.length ? profile.sensors : null;
  return clean({
    fuel: Object.keys(fuel).length ? fuel : null,
    tires: Object.keys(tires).length ? tires : null,
    params: Object.keys(params).length ? params : null,
    sensors,
  });
};

// Parameter tweak: value × factor + offset, for numbers only.
export const adjustValue = (value, config) => {
  if (!config || !isNumber(value)) return value;
  const factor = isNumber(config.factor) ? config.factor : 1;
  const offset = isNumber(config.offset) ? config.offset : 0;
  return value * factor + offset;
};

export const readAttribute = (position, key, profile) => {
  const value = Object.hasOwn(position, key) ? position[key] : position.attributes?.[key];
  return adjustValue(value, profile.params?.[key]);
};

// Fuel as a 0..1 ratio plus liters when known. The source attribute and the
// unit it reports in can be set in the profile; otherwise Traccar's `fuelLevel`
// (percent) wins, then `fuel` (liters with a tank capacity, else a percentage
// when it is 100 or less).
export const fuelReading = (position, device, profile = parseProfile(device)) => {
  const capacity = Number(device?.attributes?.fuelCapacity);
  const hasCapacity = capacity > 0;
  const fuel = profile.fuel || {};
  const unit = fuel.unit || 'auto';
  const asPercent = (percent, key) => ({
    key,
    ratio: percent / 100,
    liters: hasCapacity ? (percent / 100) * capacity : null,
    capacity: hasCapacity ? capacity : null,
  });
  const asLiters = (liters, key) =>
    hasCapacity ? { key, ratio: liters / capacity, liters, capacity } : null;

  if (fuel.source) {
    const value = readAttribute(position, fuel.source, profile);
    if (!isNumber(value)) return null;
    if (unit === 'percent') return asPercent(value, fuel.source);
    if (unit === 'liters') return asLiters(value, fuel.source);
    if (hasCapacity && value > 100) return asLiters(value, fuel.source);
    return value <= 100 ? asPercent(value, fuel.source) : null;
  }

  const level = readAttribute(position, 'fuelLevel', profile);
  const liters = readAttribute(position, 'fuel', profile);
  if (unit !== 'liters' && isNumber(level) && level <= 100) return asPercent(level, 'fuelLevel');
  if (isNumber(liters)) {
    if (unit === 'percent') return asPercent(liters, 'fuel');
    if (hasCapacity) return asLiters(liters, 'fuel');
    if (unit !== 'liters' && liters <= 100) return asPercent(liters, 'fuel');
  }
  return null;
};

// Tire pressure -------------------------------------------------------------

const wheelPatterns = {
  fl: /(front.?left|left.?front|\bfl\b|_fl|fl$|lf$)/i,
  fr: /(front.?right|right.?front|\bfr\b|_fr|fr$|rf$)/i,
  rl: /(rear.?left|left.?rear|back.?left|\brl\b|_rl|rl$|lr$)/i,
  rr: /(rear.?right|right.?rear|back.?right|\brr\b|_rr|rr$)/i,
};

export const tireCandidates = (position) =>
  Object.keys(position?.attributes || {}).filter(
    (key) =>
      /(tire|tyre|tpms|wheel)/i.test(key) &&
      !/(temp|battery|status|alarm|id$|count|leak)/i.test(key) &&
      isNumber(position.attributes[key]),
  );

// Guesses which attribute belongs to which wheel: explicit FL/FR/RL/RR names
// first, then numbered keys (1..4 as front left, front right, rear left, rear
// right).
export const detectWheels = (position) => {
  const candidates = tireCandidates(position);
  const result = {};
  wheels.forEach((wheel) => {
    const match = candidates.find((key) => wheelPatterns[wheel].test(key));
    if (match) result[wheel] = match;
  });
  if (Object.keys(result).length) return result;
  const numbered = candidates
    .map((key) => ({ key, index: Number(key.match(/(\d+)(?!.*\d)/)?.[1]) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index);
  const base = numbered.some(({ index }) => index === 0) ? 0 : 1;
  numbered.forEach(({ key, index }) => {
    const wheel = wheels[index - base];
    if (wheel && !result[wheel]) result[wheel] = key;
  });
  return result;
};

const guessInputUnit = (values) => {
  const max = Math.max(...values);
  if (max > 80) return 'kpa';
  if (max > 12) return 'psi';
  return 'bar';
};

// Pressure per wheel in the display unit, with a status against the target.
export const tireReading = (position, device, profile = parseProfile(device)) => {
  const tires = profile.tires || {};
  if (tires.show === 'off') return null;
  const mapping = { ...detectWheels(position), ...clean(tires.wheels) };
  const raw = Object.fromEntries(
    wheels.map((wheel) => [
      wheel,
      mapping[wheel] ? readAttribute(position, mapping[wheel], profile) : null,
    ]),
  );
  const values = Object.values(raw).filter(isNumber);
  if (!values.length && tires.show !== 'on') return null;
  const input =
    tires.input && tires.input !== 'auto'
      ? tires.input
      : values.length
        ? guessInputUnit(values)
        : 'bar';
  const unit = tires.unit || 'bar';
  const target = isNumber(tires.target) ? tires.target : null;
  const min = isNumber(tires.min) ? tires.min : null;
  const status = (value) => {
    if (!isNumber(value)) return 'none';
    if (value <= 0.05 * (target || 1)) return 'error';
    if (min != null && value < min) return 'error';
    if (target != null && (value < target * 0.93 || value > target * 1.2)) return 'warning';
    return 'ok';
  };
  return {
    unit,
    target,
    min,
    mapping,
    wheels: Object.fromEntries(
      wheels.map((wheel) => {
        const value = isNumber(raw[wheel]) ? convertPressure(raw[wheel], input, unit) : null;
        return [wheel, { key: mapping[wheel] || null, value, status: status(value) }];
      }),
    ),
  };
};

export const formatPressure = (value, unit) =>
  isNumber(value) ? value.toFixed(pressureDigits(unit)) : '–';

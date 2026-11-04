// Simple sensor setup for a device. A person picks "what is connected and to
// which wire"; this module turns that into the two things Traccar and the
// telemetry dashboard understand:
//
// 1. the `web.vehicle` display profile (labels, scale, fuel source), and
// 2. computed attributes for wires that must change the position itself
//    (ignition, door and panic button come from a digital input).
//
// The chosen sensors are kept in the profile as `sensors` so the editor can
// show them again. Computed attributes created here carry a `[vf:<deviceId>]`
// description prefix, so they can be found and replaced safely.

export const sensorTypes = [
  'ignition',
  'fuel',
  'temperature',
  'door',
  'panic',
  'voltage',
  'tires',
  'custom',
];

// Sensors that can appear only once per device.
export const singleSensors = new Set(['ignition', 'fuel', 'door', 'panic', 'tires']);

export const digitalInputs = ['in1', 'in2', 'in3', 'in4'];

export const analogInputs = ['adc1', 'adc2', 'adc3', 'adc4'];

export const temperatureSources = ['temp1', 'temp2', 'temp3', 'temp4', 'deviceTemp'];

export const fuelSources = ['fuelLevel', 'fuel', ...analogInputs];

export const voltageSources = ['power', 'battery', ...analogInputs];

export const fuelUnits = ['percent', 'liters', 'raw'];

let counter = 0;
const newId = () => {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
};

// A fresh sensor with sensible defaults for its type.
export const createSensor = (type, existing = []) => {
  const base = { id: newId(), type };
  const used = new Set(existing.map((sensor) => sensor.source || sensor.input));
  const firstFree = (options) => options.find((option) => !used.has(option)) || options[0];
  switch (type) {
    case 'ignition':
      return { ...base, input: 'auto' };
    case 'door':
      return { ...base, input: firstFree(['in2', 'in3', 'in4', 'in1']) };
    case 'panic':
      return { ...base, input: firstFree(['in4', 'in3', 'in2', 'in1']) };
    case 'fuel':
      return { ...base, source: 'fuelLevel', unit: 'percent' };
    case 'temperature':
      return { ...base, source: firstFree(temperatureSources), label: '' };
    case 'voltage':
      return { ...base, source: firstFree(voltageSources), label: '' };
    case 'tires':
      return { ...base, show: 'on' };
    default:
      return { ...base, source: '', label: '', factor: 1, offset: 0, unit: '' };
  }
};

const toNumber = (value) =>
  value === '' || value === null || value === undefined ? null : Number(value);

// Raw analog reading → liters, from two calibration points (empty and full tank).
export const fuelCalibration = (empty, full, capacity) => {
  const low = toNumber(empty);
  const high = toNumber(full);
  const liters = toNumber(capacity);
  if (low === null || high === null || !liters || high === low) {
    return null;
  }
  const factor = liters / (high - low);
  return { factor: Number(factor.toPrecision(8)), offset: Number((-low * factor).toPrecision(8)) };
};

export const sensorsFromProfile = (profile) =>
  Array.isArray(profile?.sensors) ? profile.sensors.map((sensor) => ({ ...sensor })) : [];

// Validation message key for a sensor, or null when it can be saved.
export const sensorProblem = (sensor) => {
  switch (sensor.type) {
    case 'fuel':
      if (!sensor.source) return 'adminSensorNeedSource';
      if (sensor.unit === 'raw' && !fuelCalibration(sensor.empty, sensor.full, sensor.capacity)) {
        return 'adminSensorNeedCalibration';
      }
      return null;
    case 'temperature':
    case 'voltage':
    case 'custom':
      return sensor.source ? null : 'adminSensorNeedSource';
    case 'door':
    case 'panic':
      return sensor.input ? null : 'adminSensorNeedInput';
    default:
      return null;
  }
};

// Writes the sensors into a display profile. Parameters and the fuel setting
// that came from a previous sensor list are replaced; hand-made parameter
// tweaks on other keys stay.
export const applySensors = (profile, sensors, labelFor) => {
  const params = Object.fromEntries(
    Object.entries(profile.params || {}).filter(([, config]) => !config?.sensor),
  );
  const previous = sensorsFromProfile(profile);
  let { fuel, tires } = profile;
  if (previous.some((sensor) => sensor.type === 'fuel')) fuel = undefined;
  if (previous.some((sensor) => sensor.type === 'tires')) tires = undefined;

  sensors.forEach((sensor) => {
    const label = sensor.label?.trim() || labelFor?.(sensor) || '';
    switch (sensor.type) {
      case 'fuel': {
        if (!sensor.source) break;
        if (sensor.unit === 'raw') {
          const calibration = fuelCalibration(sensor.empty, sensor.full, sensor.capacity);
          if (calibration) {
            params[sensor.source] = { sensor: sensor.id, label, ...calibration };
          }
          fuel = { source: sensor.source, unit: 'liters' };
        } else {
          if (label) params[sensor.source] = { sensor: sensor.id, label };
          fuel = { source: sensor.source, unit: sensor.unit };
        }
        break;
      }
      case 'temperature':
      case 'voltage':
        if (sensor.source) params[sensor.source] = { sensor: sensor.id, label };
        break;
      case 'custom': {
        if (!sensor.source) break;
        const config = { sensor: sensor.id, label };
        const factor = toNumber(sensor.factor);
        const offset = toNumber(sensor.offset);
        if (factor !== null && factor !== 1) config.factor = factor;
        if (offset !== null && offset !== 0) config.offset = offset;
        if (sensor.unit) config.unit = sensor.unit;
        params[sensor.source] = config;
        break;
      }
      case 'tires':
        tires = { ...profile.tires, show: sensor.show || 'on' };
        break;
      default:
        break;
    }
  });

  const result = { ...profile, params, sensors: sensors.map((sensor) => ({ ...sensor })) };
  if (fuel) result.fuel = fuel;
  else delete result.fuel;
  if (tires) result.tires = tires;
  else delete result.tires;
  if (!sensors.length) delete result.sensors;
  return result;
};

// Tank capacity (liters) taken from the fuel sensor, if it has one.
export const sensorFuelCapacity = (sensors) => {
  const fuel = sensors.find((sensor) => sensor.type === 'fuel');
  const capacity = toNumber(fuel?.capacity);
  return capacity && capacity > 0 ? capacity : null;
};

const inputExpression = (input) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(input) ? input : null);

// Computed attributes the sensors need, keyed by the attribute they write.
export const computedForSensors = (sensors, deviceId) => {
  const prefix = computedPrefix(deviceId);
  const result = [];
  sensors.forEach((sensor) => {
    const input = inputExpression(sensor.input);
    if (!input || sensor.input === 'auto') return;
    if (sensor.type === 'ignition') {
      result.push({
        attribute: 'ignition',
        expression: input,
        type: 'boolean',
        description: `${prefix} ignition ← ${input}`,
      });
    } else if (sensor.type === 'door') {
      result.push({
        attribute: 'door',
        expression: input,
        type: 'boolean',
        description: `${prefix} door ← ${input}`,
      });
    } else if (sensor.type === 'panic') {
      result.push({
        attribute: 'alarm',
        expression: `${input} ? "sos" : null`,
        type: 'string',
        description: `${prefix} panic ← ${input}`,
      });
    }
  });
  return result;
};

export const computedPrefix = (deviceId) => `[vf:${deviceId}]`;

// Plan to bring a device's computed attributes in line with its sensors.
// `linked` is what Traccar returns for api/attributes/computed?deviceId=…
export const planComputedSync = (linked, desired, deviceId) => {
  const prefix = computedPrefix(deviceId);
  const ours = linked.filter((item) => item.description?.startsWith(prefix));
  const create = [];
  const update = [];
  desired.forEach((want) => {
    const have = ours.find((item) => item.attribute === want.attribute);
    if (!have) {
      create.push(want);
    } else if (
      have.expression !== want.expression ||
      have.type !== want.type ||
      have.description !== want.description
    ) {
      update.push({ ...have, ...want });
    }
  });
  const remove = ours.filter((item) => !desired.some((want) => want.attribute === item.attribute));
  return { create, update, remove };
};

// Reads the value a sensor reports in the latest position, already scaled.
export const sensorReading = (sensor, position) => {
  if (!position) return undefined;
  const key =
    sensor.source ||
    (sensor.input !== 'auto' ? sensor.input : null) ||
    (sensor.type === 'ignition' ? 'ignition' : null);
  if (!key) return undefined;
  const raw = Object.hasOwn(position, key) ? position[key] : position.attributes?.[key];
  if (typeof raw !== 'number') return raw;
  if (sensor.type === 'fuel' && sensor.unit === 'raw') {
    const calibration = fuelCalibration(sensor.empty, sensor.full, sensor.capacity);
    return calibration ? raw * calibration.factor + calibration.offset : raw;
  }
  if (sensor.type === 'custom') {
    const factor = toNumber(sensor.factor) ?? 1;
    const offset = toNumber(sensor.offset) ?? 0;
    return raw * factor + offset;
  }
  return raw;
};

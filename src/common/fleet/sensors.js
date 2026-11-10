// EV battery and cold chain temperature from position attributes (pure, tested).

// temp1, temp2, ... and plain "temp"; "deviceTemp" (the tracker itself) is left out.
export const temperatureReadings = (attributes = {}) =>
  Object.entries(attributes)
    .filter(([key, value]) => /^temp\d*$/.test(key) && Number.isFinite(Number(value)))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, value]) => ({ key, value: Number(value) }));

export const batteryReading = (attributes = {}) => {
  const value = Number(attributes.batteryLevel);
  return Number.isFinite(value) && attributes.batteryLevel != null ? value : null;
};

const limit = (value) =>
  value === null || value === undefined || value === '' ? null : Number(value);

// 'ok' | 'low' | 'high' | 'none' (no reading) for a reading against optional limits.
export const readingState = (value, min, max) => {
  if (value === null || value === undefined) {
    return 'none';
  }
  const low = limit(min);
  const high = limit(max);
  if (low !== null && value < low) {
    return 'low';
  }
  if (high !== null && value > high) {
    return 'high';
  }
  return 'ok';
};

// One row per vehicle that reports a battery level or a temperature.
export const sensorRows = (devices, positions, limitsByDevice = {}) =>
  Object.values(devices)
    .map((device) => {
      const attributes = positions[device.id]?.attributes || {};
      const limits = limitsByDevice[device.id] || {};
      const temperatures = temperatureReadings(attributes).map((reading) => ({
        ...reading,
        state: readingState(reading.value, limits.temp_min, limits.temp_max),
      }));
      const battery = batteryReading(attributes);
      return {
        device,
        battery,
        charging: attributes.charge === true,
        batteryState: readingState(battery, limits.battery_min, null),
        temperatures,
        alert:
          temperatures.some((reading) => reading.state !== 'ok') ||
          readingState(battery, limits.battery_min, null) === 'low',
      };
    })
    .filter((row) => row.battery !== null || row.temperatures.length > 0)
    .sort(
      (a, b) => Number(b.alert) - Number(a.alert) || a.device.name.localeCompare(b.device.name),
    );

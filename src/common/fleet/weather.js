// SAF-07: weather where the vehicles are: heavy rain and storms, dust, extreme heat, and the
// stricter speed threshold that goes with them. Pure, tested. The data comes from Open-Meteo
// (no key) for coarse cells, so no vehicle's exact position leaves the app.

// Cells of about 25 km: positions are rounded before they are sent anywhere.
export const CELL_DEGREES = 0.25;

const round = (value) => Math.round(value / CELL_DEGREES) * CELL_DEGREES;

export const cellOf = (latitude, longitude) =>
  `${round(latitude).toFixed(2)},${round(longitude).toFixed(2)}`;

// { cell: [deviceId...] } for the vehicles with a position.
export const cellsOf = (positions) => {
  const cells = {};
  Object.values(positions || {}).forEach((position) => {
    if (!Number.isFinite(position?.latitude) || !Number.isFinite(position?.longitude)) return;
    const cell = cellOf(position.latitude, position.longitude);
    (cells[cell] = cells[cell] || []).push(position.deviceId);
  });
  return cells;
};

// WMO weather codes (Open-Meteo): heavy rain, violent showers, thunderstorms.
const HEAVY_CODES = [65, 67, 82, 95, 96, 99];
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 66, 80, 81];

// The conditions that matter for driving, from Open-Meteo's `current` block. Each is a key for
// a string: heavyRain, rain, dust, heat.
export const weatherRisks = (current) => {
  if (!current) return [];
  const risks = [];
  const rain = Number(current.precipitation) || 0;
  const code = Number(current.weather_code);
  if (rain >= 7.6 || HEAVY_CODES.includes(code)) risks.push('heavyRain');
  else if (rain >= 0.5 || RAIN_CODES.includes(code)) risks.push('rain');
  const visibility = Number(current.visibility);
  const gusts = Number(current.wind_gusts_10m);
  if (
    !risks.length &&
    ((Number.isFinite(visibility) && visibility < 1000) || (Number.isFinite(gusts) && gusts >= 60))
  ) {
    risks.push('dust');
  }
  if (Number(current.temperature_2m) >= 40) risks.push('heat');
  return risks;
};

// How much lower the speed threshold should be in these conditions (1 = unchanged).
export const speedFactor = (risks) => {
  if (risks.includes('heavyRain') || risks.includes('dust')) return 0.8;
  if (risks.includes('rain')) return 0.9;
  return 1;
};

// The stricter limit, rounded down to 5 km/h.
export const conditionSpeedLimit = (limit, risks) =>
  limit ? Math.floor((limit * speedFactor(risks)) / 5) * 5 : null;

// The Open-Meteo request for several cells at once.
export const weatherUrl = (cells) => {
  const points = cells.map((cell) => cell.split(',').map(Number));
  const query = new URLSearchParams({
    latitude: points.map(([lat]) => lat).join(','),
    longitude: points.map(([, lon]) => lon).join(','),
    current: 'precipitation,weather_code,temperature_2m,wind_gusts_10m,visibility',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
};

// Open-Meteo answers one object for one point and an array for several.
export const risksByCell = (cells, answer) => {
  const list = Array.isArray(answer) ? answer : [answer];
  return Object.fromEntries(cells.map((cell, index) => [cell, weatherRisks(list[index]?.current)]));
};

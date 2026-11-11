// OPS-10: CO2 per vehicle, for ESG reports and tenders. Pure, unit-tested.
//
// From fuel liters when the fuel imports cover the vehicle, otherwise estimated from the
// kilometers and the fuel type. Tailpipe CO2 only (scope 1); an electric vehicle has none here.

// kg CO2 per liter burned (DEFRA 2024 conversion factors, rounded).
export const KG_PER_LITER = {
  petrol: 2.31,
  diesel: 2.66,
  gas: 1.56, // LPG
};

// kg CO2 per km for an average car when there are no liters (DEFRA 2024, average car).
export const KG_PER_KM = {
  petrol: 0.164,
  diesel: 0.168,
  hybrid: 0.12,
  gas: 0.177,
  electric: 0,
};

const litersFactor = (fuelType) =>
  KG_PER_LITER[fuelType === 'hybrid' ? 'petrol' : fuelType] ?? KG_PER_LITER.petrol;

// The fuel a transaction was for: its own type, else the vehicle's.
const normalize = (value) => {
  const text = String(value || '').toLowerCase();
  if (/diesel|סולר|דיזל/.test(text)) return 'diesel';
  // Petrol first: "gasoline" contains "gas".
  if (/petrol|gasoline|benzin|בנזין|95|98/.test(text)) return 'petrol';
  if (/lpg|gas|גז/.test(text)) return 'gas';
  return null;
};

// devices: Traccar devices; summary: Traccar summary rows ({ deviceId, distance m });
// fuel: [{ deviceId, liters, fuel_type, occurred_at }]; fuelTypes: { deviceId: fuel_type }.
export const emissionsByVehicle = (devices, summary, fuel, fuelTypes = {}) =>
  devices.map((device) => {
    const km =
      summary
        .filter((row) => row.deviceId === device.id)
        .reduce((total, row) => total + (Number(row.distance) || 0), 0) / 1000;
    const fuelType = fuelTypes[device.id] || null;
    const own = fuel.filter((row) => row.deviceId === device.id && Number(row.liters) > 0);
    const liters = own.reduce((total, row) => total + Number(row.liters), 0);
    let co2;
    let method;
    if (liters > 0) {
      co2 = own.reduce(
        (total, row) =>
          total + Number(row.liters) * litersFactor(normalize(row.fuel_type) || fuelType),
        0,
      );
      method = 'liters';
    } else if (km > 0) {
      co2 = km * (KG_PER_KM[fuelType] ?? KG_PER_KM.petrol);
      method = fuelType ? 'distance' : 'distanceDefault';
    } else {
      co2 = 0;
      method = null;
    }
    return {
      deviceId: device.id,
      name: device.name,
      fuelType,
      distance: km * 1000,
      liters,
      co2,
      perKm: km > 0 ? (co2 * 1000) / km : null, // grams per km
      method,
    };
  });

// Fuel-based CO2 per calendar month (YYYY-MM → kg), for the trend line in the summary.
export const emissionsByMonth = (fuel, fuelTypes = {}) => {
  const months = {};
  fuel.forEach((row) => {
    if (!(Number(row.liters) > 0)) return;
    const month = String(row.occurred_at).slice(0, 7);
    const factor = litersFactor(normalize(row.fuel_type) || fuelTypes[row.deviceId]);
    months[month] = (months[month] || 0) + Number(row.liters) * factor;
  });
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, co2]) => ({ month, co2 }));
};

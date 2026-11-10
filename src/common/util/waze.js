// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// ISR-14: a Waze navigation link (waze.com/ul is free, needs no key, and opens the app on a phone).
// Coordinates win over an address; with neither there is no link.
export const wazeUrl = ({ latitude, longitude, address } = {}) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    latitude != null &&
    longitude != null &&
    latitude !== '' &&
    longitude !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  ) {
    return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  }
  const text = typeof address === 'string' ? address.trim() : '';
  return text ? `https://waze.com/ul?q=${encodeURIComponent(text)}&navigate=yes` : null;
};

export default wazeUrl;

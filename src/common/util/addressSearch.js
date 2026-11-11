// ISR-10: Hebrew addresses. Street suggestions come from the official list of streets of the
// Population Authority (data.gov.il, public, no key): the names the municipalities use, so
// "שד הרצל" is found as typed. The chosen address gets its coordinates from a geocoder that
// speaks the Nominatim API: the server setting `web.geocoderUrl`, else OpenStreetMap's
// Nominatim (one request per chosen address, as its usage policy allows; not for typing).

export const STREETS_URL = 'https://data.gov.il/api/3/action/datastore_search';
export const STREETS_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
export const DEFAULT_GEOCODER = 'https://nominatim.openstreetmap.org/search';

// "הרצל 12 רמת גן" -> { text: 'הרצל רמת גן', number: '12' }. Pure.
export const splitHouseNumber = (query) => {
  const match = /(^|\s)(\d+[א-ת]?)(?=\s|$)/.exec(query);
  if (!match) return { text: query.trim(), number: '' };
  return {
    text: `${query.slice(0, match.index)} ${query.slice(match.index + match[0].length)}`
      .replace(/\s+/g, ' ')
      .trim(),
    number: match[2],
  };
};

// The address as people write it: "הרצל 12, רמת גן". Pure.
export const formatAddress = ({ street, number, city }) =>
  [[street, number].filter(Boolean).join(' '), city].filter(Boolean).join(', ');

const cache = new Map();

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal, fetcher?: typeof fetch }} [options]
 */
export const searchStreets = async (query, options = {}) => {
  const { signal, fetcher = fetch } = options;
  const { text, number } = splitHouseNumber(query);
  if (text.length < 2) return [];
  const key = `s:${text}`;
  if (!cache.has(key)) {
    const params = new URLSearchParams({ resource_id: STREETS_RESOURCE, q: text, limit: '8' });
    const response = await fetcher(`${STREETS_URL}?${params}`, { signal });
    if (!response.ok) return [];
    const body = await response.json();
    cache.set(
      key,
      (body.result?.records || []).map((record) => ({
        street: String(record['שם_רחוב'] || '').trim(),
        city: String(record['שם_ישוב'] || '').trim(),
      })),
    );
  }
  return cache.get(key).map((item) => ({ ...item, number }));
};

/**
 * @param {string} address
 * @param {{ signal?: AbortSignal, url?: string, fetcher?: typeof fetch }} [options]
 */
export const geocodeAddress = async (address, options = {}) => {
  const { signal, url, fetcher = fetch } = options;
  const key = `g:${address}`;
  if (!cache.has(key)) {
    const params = new URLSearchParams({
      q: address,
      format: 'jsonv2',
      countrycodes: 'il',
      limit: '1',
      'accept-language': 'he',
    });
    const response = await fetcher(`${url || DEFAULT_GEOCODER}?${params}`, { signal });
    if (!response.ok) return null;
    const [first] = await response.json();
    cache.set(key, first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null);
  }
  return cache.get(key);
};

// LIV-22: favorite vehicles at the top of the list, and named views (filter, sort, map area)
// that can be switched and shared as a link.

export const pinFavorites = (devices, favorites) => {
  if (!favorites?.length) return devices;
  const pinned = new Set(favorites);
  return [
    ...devices.filter((device) => pinned.has(device.id)),
    ...devices.filter((device) => !pinned.has(device.id)),
  ];
};

export const toggleFavorite = (favorites, id) =>
  favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];

const ids = (value) => (Array.isArray(value) ? value.filter((item) => item != null) : []);

// Only what a view may carry, so a shared link cannot inject anything else.
export const sanitizeView = (view) => {
  if (!view || typeof view !== 'object' || typeof view.name !== 'string') return null;
  const name = view.name.trim().slice(0, 60);
  if (!name) return null;
  const filter = view.filter || {};
  const bounds =
    Array.isArray(view.bounds) && view.bounds.flat().length === 4
      ? view.bounds.map((corner) => corner.map(Number))
      : null;
  return {
    name,
    filter: {
      activities: ids(filter.activities).map(String),
      statuses: ids(filter.statuses).map(String),
      groups: ids(filter.groups).map(Number),
      geofences: ids(filter.geofences).map(Number),
    },
    sort: ['', 'name', 'lastUpdate'].includes(view.sort) ? view.sort : '',
    filterMap: view.filterMap !== false,
    bounds: bounds && bounds.flat().every(Number.isFinite) ? bounds : null,
  };
};

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

export const encodeView = (view) => toBase64Url(JSON.stringify(sanitizeView(view)));

export const decodeView = (text) => {
  try {
    return sanitizeView(JSON.parse(fromBase64Url(text)));
  } catch {
    return null;
  }
};

// Saving under an existing name replaces that view.
export const upsertView = (views, view) => [
  ...views.filter((item) => item.name !== view.name),
  view,
];

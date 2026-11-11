// PRF-05: an accuracy circle in meters as a MapLibre circle radius in pixels. At zoom z one
// pixel covers EARTH / 512 / 2^z meters at the equator, times cos(latitude), for 512-pixel
// tiles. The radius at zoom 0 is kept on each point; the zoom doubles it per level, which an
// exponential (base 2) interpolation draws exactly.
const METERS_PER_PIXEL_Z0 = 40075016.686 / 512;
const MAX_ZOOM = 24;

export const accuracyRadiusAtZoomZero = (accuracy, latitude) =>
  accuracy / (METERS_PER_PIXEL_Z0 * Math.cos((latitude * Math.PI) / 180));

export const accuracyRadiusExpression = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', 'r0'],
  MAX_ZOOM,
  ['*', ['get', 'r0'], 2 ** MAX_ZOOM],
];

// The radius in pixels at a zoom (what the expression gives), for tests.
export const accuracyRadiusPixels = (accuracy, latitude, zoom) =>
  accuracyRadiusAtZoomZero(accuracy, latitude) * 2 ** zoom;

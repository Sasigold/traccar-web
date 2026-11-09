// A wider line under a colored map line (white on the light map, ink on the dark one), so
// aqua routes and geofence edges stand out from any basemap. Goes before the line it frames.
export const casingLayer = (theme, extra = {}) => ({
  key: 'casing',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color':
      theme.palette.mode === 'dark' ? theme.palette.brand.ink : theme.palette.brand.white,
    'line-width': ['+', ['get', 'width'], 3],
    'line-opacity': ['get', 'opacity'],
  },
  ...extra,
});

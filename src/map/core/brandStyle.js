import { mapPalette } from '../../common/theme/mapPalette';

// Recolors an OpenMapTiles style (OpenFreeMap Liberty) into the brand basemap, light or dark.
// Only colors change: layer order, widths, zoom rules and labels stay as the style made them.

const set = (layer, paint, layout) => ({
  ...layer,
  paint: { ...layer.paint, ...paint },
  ...(layout && { layout: { ...layer.layout, ...layout } }),
});

const hide = (layer) => set(layer, {}, { visibility: 'none' });

const recolor = (layer, c) => {
  const { id, type } = layer;
  if (type === 'background') {
    return set(layer, { 'background-color': c.land });
  }
  if (type === 'raster') {
    return c.natureOpacity
      ? set(layer, { 'raster-saturation': -1, 'raster-opacity': c.natureOpacity })
      : hide(layer);
  }
  if (type === 'fill-extrusion') {
    return set(layer, { 'fill-extrusion-color': c.building, 'fill-extrusion-opacity': 0.6 });
  }
  if (type === 'fill') {
    if (id === 'water') {
      return set(layer, { 'fill-color': c.water, 'fill-opacity': c.waterOpacity });
    }
    if (id === 'building') {
      return set(layer, { 'fill-color': c.building, 'fill-outline-color': c.building });
    }
    if (id === 'landuse_residential') {
      return set(layer, { 'fill-color': c.landSoft, 'fill-opacity': 0.5 });
    }
    if (id === 'road_area_pattern' || id === 'landcover_wetland') {
      // Bitmap patterns cannot be recolored; a flat tone instead.
      const paint = { ...layer.paint, 'fill-color': c.green, 'fill-opacity': 0.35 };
      delete paint['fill-pattern'];
      return { ...layer, paint };
    }
    if (id.startsWith('aeroway')) {
      return set(layer, { 'fill-color': c.landSoft, 'fill-opacity': 0.8 });
    }
    // Parks, woods, grass, sports grounds, schools, hospitals, cemeteries, sand, ice.
    return set(layer, { 'fill-color': c.green, 'fill-opacity': 0.35 });
  }
  if (type === 'line') {
    if (id.startsWith('waterway')) {
      return set(layer, { 'line-color': c.waterLine });
    }
    if (id === 'park_outline') {
      return hide(layer);
    }
    if (id.startsWith('boundary')) {
      return set(layer, { 'line-color': c.boundary });
    }
    if (id.startsWith('aeroway')) {
      return set(layer, { 'line-color': c.road });
    }
    if (/rail/.test(id)) {
      return set(layer, { 'line-color': c.rail });
    }
    if (/path|pedestrian/.test(id)) {
      return set(layer, { 'line-color': c.path });
    }
    const major = /motorway|trunk|primary/.test(id);
    if (id.endsWith('_casing')) {
      return set(layer, { 'line-color': major ? c.roadMajorCasing : c.roadCasing });
    }
    return set(layer, { 'line-color': major ? c.roadMajor : c.road });
  }
  if (type === 'symbol') {
    const paint = { 'text-halo-color': c.halo, 'text-halo-width': 1.2 };
    if (/^water|waterway/.test(id)) {
      return set(layer, { ...paint, 'text-color': c.labelWater });
    }
    if (/^label_(city|state|country|town)/.test(id)) {
      return set(layer, { ...paint, 'text-color': c.labelMajor });
    }
    if (id.startsWith('poi') || id === 'airport') {
      // The style's colored icons are not in the palette: the names stay, the icons go.
      return set(layer, { ...paint, 'text-color': c.label }, { 'icon-image': '' });
    }
    if (id.startsWith('road_one_way')) {
      return set(layer, { 'icon-opacity': 0.4 });
    }
    if (/shield/.test(id)) {
      // White road number plates glare on the night map.
      return c.shields ? layer : hide(layer);
    }
    return set(layer, { ...paint, 'text-color': c.label });
  }
  return layer;
};

export const brandStyle = (style, dark) => {
  if (!style?.layers) {
    return style;
  }
  const colors = dark ? mapPalette.dark : mapPalette.light;
  return { ...style, layers: style.layers.map((layer) => recolor(layer, colors)) };
};

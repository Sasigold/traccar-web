import { describe, expect, it } from 'vitest';
import { brandStyle } from '../brandStyle';
import { mapPalette } from '../../../common/theme/mapPalette';

const style = {
  version: 8,
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'x' } },
    { id: 'water', type: 'fill', paint: { 'fill-color': 'x' } },
    { id: 'road_motorway', type: 'line', paint: { 'line-color': 'x', 'line-width': 4 } },
    { id: 'road_minor_casing', type: 'line', paint: { 'line-color': 'x' } },
    { id: 'road_area_pattern', type: 'fill', paint: { 'fill-pattern': 'p' } },
    { id: 'poi_r1', type: 'symbol', layout: { 'icon-image': 'shop' }, paint: {} },
    { id: 'road_shield_us', type: 'symbol', layout: {}, paint: {} },
    { id: 'label_city', type: 'symbol', layout: {}, paint: { 'text-color': 'x' } },
  ],
};
const byId = (result) => Object.fromEntries(result.layers.map((layer) => [layer.id, layer]));

describe('brand basemap', () => {
  it('recolors the light map and keeps widths and order', () => {
    const light = byId(brandStyle(style, false));
    const c = mapPalette.light;
    expect(light.background.paint['background-color']).toBe(c.land);
    expect(light.water.paint['fill-color']).toBe(c.water);
    expect(light.road_motorway.paint).toEqual({ 'line-color': c.roadMajor, 'line-width': 4 });
    expect(light.road_minor_casing.paint['line-color']).toBe(c.roadCasing);
    expect(light.road_area_pattern.paint['fill-pattern']).toBeUndefined();
    expect(light.poi_r1.layout['icon-image']).toBe('');
    expect(light.road_shield_us.layout.visibility).toBeUndefined();
    expect(light.label_city.paint['text-color']).toBe(c.labelMajor);
    expect(brandStyle(style, false).layers.map((layer) => layer.id)).toEqual(
      style.layers.map((layer) => layer.id),
    );
  });

  it('makes a night map and hides the road plates', () => {
    const dark = byId(brandStyle(style, true));
    expect(dark.background.paint['background-color']).toBe(mapPalette.dark.land);
    expect(dark.road_shield_us.layout.visibility).toBe('none');
  });

  it('leaves styles without layers alone', () => {
    expect(brandStyle(null, false)).toBeNull();
  });
});

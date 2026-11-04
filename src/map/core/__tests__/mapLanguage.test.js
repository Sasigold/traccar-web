import { describe, expect, it } from 'vitest';
import { localizeStyle, localizedNameExpression } from '../mapLanguage';

const symbol = (id, textField) => ({
  id,
  type: 'symbol',
  layout: { 'text-size': 12, 'text-field': textField },
});

describe('localizeStyle', () => {
  const openFreeMapLabel = [
    'case',
    ['has', 'name:nonlatin'],
    ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
    ['coalesce', ['get', 'name_en'], ['get', 'name']],
  ];

  const style = {
    version: 8,
    layers: [
      symbol('place', openFreeMapLabel),
      symbol('locationiq-place', '{name_en}'),
      symbol('waterway', '{name}'),
      symbol('shield', ['to-string', ['get', 'ref']]),
      symbol('housenumber', '{house_num}'),
      symbol('icon-only', undefined),
      { id: 'water', type: 'fill', layout: {} },
    ],
  };

  it('points every name label at the requested language', () => {
    const localized = localizeStyle(style, 'he');
    const field = (id) => localized.layers.find((l) => l.id === id).layout['text-field'];
    expect(field('place')).toEqual(localizedNameExpression('he'));
    expect(field('locationiq-place')).toEqual(localizedNameExpression('he'));
    expect(field('waterway')).toEqual(localizedNameExpression('he'));
  });

  it('prefers both tile naming conventions and falls back to the local name', () => {
    expect(localizedNameExpression('he').slice(0, 4)).toEqual([
      'coalesce',
      ['get', 'name:he'],
      ['get', 'name_he'],
      ['get', 'name'],
    ]);
  });

  it('leaves labels that are not names alone', () => {
    const localized = localizeStyle(style, 'he');
    const layer = (id) => localized.layers.find((l) => l.id === id);
    expect(layer('shield')).toBe(style.layers[3]);
    expect(layer('housenumber')).toBe(style.layers[4]);
    expect(layer('icon-only')).toBe(style.layers[5]);
    expect(layer('water')).toBe(style.layers[6]);
  });

  it('keeps other layout properties and does not mutate the input', () => {
    const localized = localizeStyle(style, 'he');
    expect(localized.layers[0].layout['text-size']).toBe(12);
    expect(style.layers[0].layout['text-field']).toEqual(openFreeMapLabel);
  });

  it('passes raster styles and missing input through unchanged', () => {
    const raster = {
      version: 8,
      sources: {},
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    };
    expect(localizeStyle(raster, 'he').layers[0]).toBe(raster.layers[0]);
    expect(localizeStyle(undefined, 'he')).toBeUndefined();
    expect(localizeStyle('https://example.com/style.json', 'he')).toBe(
      'https://example.com/style.json',
    );
  });
});

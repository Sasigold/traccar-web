import { describe, expect, it } from 'vitest';
import {
  decodeView,
  encodeView,
  pinFavorites,
  sanitizeView,
  toggleFavorite,
  upsertView,
} from '../savedViews';

// LIV-22: favorites and saved views.
const view = {
  name: 'מחסן צפון · משאיות',
  filter: { statuses: ['online'], groups: [3], geofences: [], activities: ['moving'] },
  sort: 'name',
  filterMap: true,
  bounds: [
    [34.7, 32.0],
    [35.0, 32.3],
  ],
};

describe('favorite vehicles', () => {
  it('come first, keeping the order of each part', () => {
    const devices = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(pinFavorites(devices, [3, 1]).map((d) => d.id)).toEqual([1, 3, 2, 4]);
    expect(pinFavorites(devices, [])).toBe(devices);
  });

  it('toggle on and off', () => {
    expect(toggleFavorite([1], 2)).toEqual([1, 2]);
    expect(toggleFavorite([1, 2], 1)).toEqual([2]);
  });
});

describe('saved views', () => {
  it('round-trip through a link, in Hebrew', () => {
    expect(decodeView(encodeView(view))).toEqual(view);
    expect(encodeView(view)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('keep only what a view may carry', () => {
    const cleaned = sanitizeView({
      ...view,
      sort: 'evil',
      extra: 'x',
      bounds: [
        ['a', 1],
        [2, 3],
      ],
      filter: { groups: ['5', null], statuses: 'online' },
    });
    expect(cleaned).toEqual({
      name: view.name,
      filter: { activities: [], statuses: [], groups: [5], geofences: [] },
      sort: '',
      filterMap: true,
      bounds: null,
    });
    expect(sanitizeView({ name: '  ' })).toBeNull();
    expect(decodeView('not-a-view')).toBeNull();
  });

  it('replace a view saved under the same name', () => {
    const views = upsertView([{ name: 'א', sort: '' }], { name: 'א', sort: 'name' });
    expect(views).toEqual([{ name: 'א', sort: 'name' }]);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { loadGcoord, setCoordinateSystem } from '../mapState';
import { fromMapCoordinates, toMapCoordinates } from '../mapUtil';

// FND-10: gcoord loads only for a Chinese map; WGS84 maps never need it.
describe('map coordinates', () => {
  afterEach(() => setCoordinateSystem(null));

  it('leaves WGS84 points as they are', () => {
    expect(toMapCoordinates(34.78, 32.08)).toEqual([34.78, 32.08]);
  });

  it('converts to and from GCJ-02 once gcoord is loaded', async () => {
    await loadGcoord();
    setCoordinateSystem('gcj02');
    const [lon, lat] = toMapCoordinates(116.397, 39.909);
    expect(lon).not.toBeCloseTo(116.397, 4);
    const [back, backLat] = fromMapCoordinates(lon, lat);
    expect(back).toBeCloseTo(116.397, 4);
    expect(backLat).toBeCloseTo(39.909, 4);
  });
});

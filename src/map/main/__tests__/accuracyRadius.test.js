import { describe, expect, it } from 'vitest';
import { accuracyRadiusAtZoomZero, accuracyRadiusPixels } from '../accuracyRadius';

// PRF-05: the circle covers the accuracy in meters at every zoom.
describe('accuracy radius', () => {
  it('matches the ground resolution of 512-pixel tiles', () => {
    // At the equator, zoom 0: 78,271.5 m per pixel.
    expect(accuracyRadiusAtZoomZero(78271.517, 0)).toBeCloseTo(1, 4);
    // Tel Aviv (32°N), zoom 16: about 1.01 m per pixel, so 50 m is about 49 px.
    expect(accuracyRadiusPixels(50, 32, 16)).toBeCloseTo(49.4, 0);
  });

  it('doubles with every zoom level', () => {
    expect(accuracyRadiusPixels(30, 32, 15) * 2).toBeCloseTo(accuracyRadiusPixels(30, 32, 16), 6);
  });
});

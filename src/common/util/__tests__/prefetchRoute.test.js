import { describe, expect, it } from 'vitest';
import { loaderFor } from '../prefetchRoute';

describe('prefetching a screen (LIV-16)', () => {
  it('finds the screen of a navigation path', () => {
    expect(loaderFor('/dashboard')).toBeTypeOf('function');
    expect(loaderFor('/reports/combined')).toBe(loaderFor('/reports'));
    expect(loaderFor('/')).toBeNull();
    expect(loaderFor('/fleetx')).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { beat, useReducedMotion } from '../motion';

// BRD-03: motion follows the reduced-motion setting, live.
const mockQuery = (matches) => {
  const listeners = new Set();
  const query = {
    matches,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  window.matchMedia = () => query;
  return {
    set: (value) => {
      query.matches = value;
      listeners.forEach((listener) => listener());
    },
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('the motion language', () => {
  it('follows a change of the reduced-motion setting', () => {
    const query = mockQuery(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => query.set(true));
    expect(result.current).toBe(true);
  });

  it('plays a beat only when motion is allowed', () => {
    const element = { animate: vi.fn(() => 'animation') };
    mockQuery(false);
    expect(beat(element, [{ opacity: 0 }, { opacity: 1 }])).toBe('animation');
    mockQuery(true);
    expect(beat(element, [{ opacity: 0 }, { opacity: 1 }])).toBeNull();
    expect(element.animate).toHaveBeenCalledTimes(1);
  });
});

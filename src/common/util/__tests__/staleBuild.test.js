import { describe, expect, it, vi } from 'vitest';
import { installStaleBuildRecovery, isChunkLoadError, reloadForNewBuild } from '../staleBuild';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

describe('stale build recovery', () => {
  it("recognizes the browsers' chunk errors and nothing else", () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(
      isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('reloads once, then lets the error show within the minute', () => {
    const storage = memory();
    const reload = vi.fn();
    expect(reloadForNewBuild({ storage, reload, now: 1000 })).toBe(true);
    expect(reloadForNewBuild({ storage, reload, now: 30000 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewBuild({ storage, reload, now: 1000 + 61000 })).toBe(true);
  });

  it('does not loop without storage', () => {
    const reload = vi.fn();
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(reloadForNewBuild({ storage: broken, reload, now: 1 })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("handles Vite's preload error event", () => {
    let handler;
    const target = {
      addEventListener: (name, fn) => {
        if (name === 'vite:preloadError') handler = fn;
      },
      sessionStorage: memory(),
      location: { reload: vi.fn() },
    };
    installStaleBuildRecovery(target);
    const event = { preventDefault: vi.fn() };
    handler(event);
    expect(target.location.reload).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recentReportIds, rememberReport } from '../recentReports';

// The tests run in Node: a small in-memory localStorage stands in for the browser's.
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    clear: () => values.clear(),
  };
};

describe('recent reports', () => {
  beforeEach(() => vi.stubGlobal('window', { localStorage: memoryStorage() }));

  it('keeps the last three, newest first, without repeats', () => {
    ['trips', 'stops', 'trips', 'events', 'summary'].forEach(rememberReport);
    expect(recentReportIds()).toEqual(['summary', 'events', 'trips']);
  });

  it('survives bad storage', () => {
    window.localStorage.setItem('recentReports', '{oops');
    expect(recentReportIds()).toEqual([]);
  });
});

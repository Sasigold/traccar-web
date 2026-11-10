import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metrics } from '../metrics';
import { unwrap } from '../../fleet/client';
import fetchOrThrow from '../../util/fetchOrThrow';
import { metricsRequest, reportError } from '../install';

// FND-06: the operational counters are counted where things fail.
describe('operational counters', () => {
  beforeEach(() => {
    metrics.take();
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts Supabase errors by code, but not cancelled requests', () => {
    expect(() => unwrap({ error: { code: '42501', message: 'denied' }, status: 403 })).toThrow();
    expect(() =>
      unwrap({ error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }),
    ).toThrow();
    expect(() => unwrap({ error: { message: 'TypeError: Failed to fetch' } })).toThrow();
    expect(() =>
      unwrap({ error: { name: 'AbortError', message: 'AbortError: aborted' } }),
    ).toThrow();
    expect(unwrap({ data: [1] })).toEqual([1]);
    expect(metrics.take().counters).toEqual({
      'fleet_error.42501': 1,
      'fleet_error.pgrst301': 1,
      'fleet_error.network': 1,
    });
  });

  it('counts expired sessions, server errors and network failures of the tracking server', async () => {
    const respond = (status) => ({ ok: false, status, text: async () => '' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respond(401))
        .mockResolvedValueOnce(respond(503))
        .mockResolvedValueOnce(respond(400))
        .mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );
    await expect(fetchOrThrow('api/devices')).rejects.toThrow();
    await expect(fetchOrThrow('api/devices')).rejects.toThrow();
    await expect(fetchOrThrow('api/devices')).rejects.toThrow();
    await expect(fetchOrThrow('api/devices')).rejects.toThrow();
    expect(metrics.take().counters).toEqual({
      'api_error.401': 1,
      'api_error.503': 1,
      'api_error.network': 1,
    });
  });

  it('counts errors even when no error service is set', () => {
    reportError(new Error('x'), 'boundary');
    reportError(new Error('y'));
    expect(metrics.take().counters).toEqual({ render_error: 1, js_error: 1 });
  });
});

describe('metricsRequest', () => {
  it('calls record_client_metrics with the user token', () => {
    const batch = {
      counters: { a: 1 },
      vitals: [],
      longtasks: { count: 0, total_ms: 0, max_ms: 0 },
    };
    const { url, init } = metricsRequest({
      url: 'https://fleet.example.com',
      anonKey: 'anon',
      token: 'jwt',
      batch,
      environment: 'staging',
    });
    expect(url).toBe('https://fleet.example.com/rest/v1/rpc/record_client_metrics');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: { apikey: 'anon', Authorization: 'Bearer jwt' },
    });
    expect(JSON.parse(init.body)).toEqual({
      p_release: expect.any(String),
      p_environment: 'staging',
      p_metrics: batch,
    });
  });
});

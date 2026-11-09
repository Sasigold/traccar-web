import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ fleetConfig: { url: 'https://fleet.test', anonKey: 'anon' } }));
vi.mock('../../util/fetchOrThrow', () => ({
  default: vi.fn(async () => ({ text: async () => 'traccar-token' })),
}));

const minted = (seconds) => ({
  ok: true,
  json: async () => ({ access_token: `jwt-${seconds}`, expires_at: Date.now() / 1000 + seconds }),
});

describe('fleet session', () => {
  let session;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn();
    session = await import('../session');
  });
  afterEach(() => {
    delete globalThis.fetch;
  });

  it('renews a JWT that is about to expire before the request goes out', async () => {
    globalThis.fetch.mockResolvedValueOnce(minted(60)).mockResolvedValueOnce(minted(3600));
    await session.ensureFleetSession(7);
    expect(session.getFleetAccessToken()).toBe('jwt-60');
    expect(await session.getFreshFleetAccessToken()).toBe('jwt-3600');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives no token after logout', async () => {
    globalThis.fetch.mockResolvedValueOnce(minted(3600));
    await session.ensureFleetSession(7);
    session.clearFleetSession();
    expect(session.getFleetAccessToken()).toBeNull();
    expect(await session.getFreshFleetAccessToken()).toBeNull();
  });

  it('never hands one user the JWT of another', async () => {
    globalThis.fetch.mockResolvedValueOnce(minted(3600));
    await session.ensureFleetSession(7);
    globalThis.fetch.mockResolvedValueOnce(minted(1800));
    await session.ensureFleetSession(8);
    expect(session.getFleetSession().traccarUserId).toBe(8);
    expect(session.getFleetAccessToken()).toBe('jwt-1800');
  });

  it('drops a JWT that arrives after logout', async () => {
    let resolve;
    globalThis.fetch.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const request = session.ensureFleetSession(7);
    session.clearFleetSession();
    resolve(minted(3600));
    await expect(request).rejects.toThrow();
    expect(session.getFleetAccessToken()).toBeNull();
  });
});

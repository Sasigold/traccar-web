import { afterEach, describe, expect, it, vi } from 'vitest';
import { putServerAttribute, putUserAttribute, saveOwnDashboards, withAttribute } from '../remote';

// ARC-09: a save reads the latest object and changes one attribute only.
const fakeServer = (stored) => {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({ url, method: init.method || 'GET', body: init.body && JSON.parse(init.body) });
      const body = init.method === 'PUT' ? JSON.parse(init.body) : stored;
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
};

afterEach(() => vi.unstubAllGlobals());

describe('withAttribute', () => {
  it('sets or removes one attribute and keeps the rest', () => {
    const user = { id: 1, name: 'a', attributes: { a: 1, b: 2 } };
    expect(withAttribute(user, 'b', 3)).toEqual({ id: 1, name: 'a', attributes: { a: 1, b: 3 } });
    expect(withAttribute(user, 'b', undefined).attributes).toEqual({ a: 1 });
    expect(withAttribute({ id: 1 }, 'x', 'y').attributes).toEqual({ x: 'y' });
    expect(user.attributes).toEqual({ a: 1, b: 2 });
  });
});

describe('putUserAttribute', () => {
  it('merges into the copy the server has now, not the one the page loaded', async () => {
    const calls = fakeServer({ id: 7, name: 'renamed meanwhile', attributes: { other: 'new' } });
    const saved = await putUserAttribute(7, 'web.dashboard', '{"v":1}');
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PUT']);
    expect(calls[1].url).toBe('api/users/7');
    expect(calls[1].body).toEqual({
      id: 7,
      name: 'renamed meanwhile',
      attributes: { other: 'new', 'web.dashboard': '{"v":1}' },
    });
    expect(saved.name).toBe('renamed meanwhile');
  });

  it('does not write when the latest copy has no room', async () => {
    const calls = fakeServer({ id: 7, attributes: {} });
    expect(await putUserAttribute(7, 'web.dashboard', 'x', () => false)).toBeNull();
    expect(calls.map((call) => call.method)).toEqual(['GET']);
  });
});

describe('putServerAttribute', () => {
  it('keeps every other server setting as it is now', async () => {
    const calls = fakeServer({ id: 1, registration: true, attributes: { setByOther: 1 } });
    await putServerAttribute('web.dashboardDefault', 'd');
    expect(calls[1]).toMatchObject({
      url: 'api/server',
      method: 'PUT',
      body: {
        id: 1,
        registration: true,
        attributes: { setByOther: 1, 'web.dashboardDefault': 'd' },
      },
    });
  });
});

describe('saveOwnDashboards', () => {
  it('upserts the person’s one row with the document as JSON', async () => {
    const upsert = vi.fn(async () => ({ data: null, error: null, status: 201 }));
    const client = { from: vi.fn(() => ({ upsert })) };
    await saveOwnDashboards(client, { orgId: 'o1', profileId: 'p1' }, '{"v":1,"d":[]}');
    expect(client.from).toHaveBeenCalledWith('dashboards');
    expect(upsert).toHaveBeenCalledWith(
      { org_id: 'o1', profile_id: 'p1', doc: { v: 1, d: [] } },
      { onConflict: 'profile_id' },
    );
  });
});

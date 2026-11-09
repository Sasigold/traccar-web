import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  decodeCursor,
  encodeCursor,
  handle,
  keyOf,
  parseQuery,
  publicBase,
  routeOf,
} from '../core.js';
import { buildOpenApi } from '../openapi.js';
import { RESOURCE_NAMES } from '../resources.js';

const KEY = `vf_${'a'.repeat(40)}`;
const ORG = 'a2000000-0000-0000-0000-000000000000';
const BASE = 'https://api.example.com/functions/v1/public-api';

const request = (path, { method = 'GET', headers = {} } = {}) =>
  new Request(`${BASE}${path}`, { method, headers });

const okAuth = {
  status: 200,
  org_id: ORG,
  key_id: 'k1',
  limit: 60,
  remaining: 59,
  reset: 1800000000,
};

const rpcWith = (auth, page) => vi.fn(async (name) => (name === 'api_authorize' ? auth : page));

describe('routing helpers', () => {
  it('finds the route after the last version segment', () => {
    expect(routeOf('/public-api/v1/vehicles')).toBe('vehicles');
    expect(routeOf('/functions/v1/public-api/v1/vehicles')).toBe('vehicles');
    expect(routeOf('/public-api/v1')).toBe('');
    expect(routeOf('/public-api')).toBeNull();
  });

  it('reads the key from either header', () => {
    expect(keyOf(new Headers({ 'X-API-Key': ` ${KEY} ` }))).toBe(KEY);
    expect(keyOf(new Headers({ Authorization: `Bearer ${KEY}` }))).toBe(KEY);
    expect(keyOf(new Headers({ Authorization: `Basic abc` }))).toBeNull();
    expect(keyOf(new Headers())).toBeNull();
  });

  it('keeps cursors opaque and rejects made-up ones', () => {
    expect(decodeCursor(encodeCursor(300))).toBe(300);
    expect(decodeCursor('')).toBe(0);
    expect(decodeCursor('not base64!')).toBeNull();
    expect(decodeCursor(encodeCursor('-5'))).toBeNull();
  });

  it('checks the query', () => {
    expect(parseQuery(new URLSearchParams(''))).toEqual({ limit: 100, offset: 0, since: null });
    expect(parseQuery(new URLSearchParams('limit=0')).error).toMatch(/limit/);
    expect(parseQuery(new URLSearchParams('limit=1001')).error).toMatch(/limit/);
    expect(parseQuery(new URLSearchParams('limit=2.5')).error).toMatch(/limit/);
    expect(parseQuery(new URLSearchParams('updated_since=yesterday')).error).toMatch(/ISO/);
    expect(parseQuery(new URLSearchParams('updated_since=2026-11-01')).since).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('builds public links behind a proxy', () => {
    const inner = new Request('http://functions:9000/public-api/v1/vehicles', {
      headers: {
        'X-Forwarded-Host': 'api.example.com',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Prefix': '/functions/v1',
      },
    });
    expect(publicBase(inner)).toBe('https://api.example.com/functions/v1/public-api/v1');
    expect(publicBase(inner, 'https://fleet.example.com/api/')).toBe(
      'https://fleet.example.com/api/v1',
    );
    expect(publicBase(request('/v1/vehicles'))).toBe(`${BASE}/v1`);
  });
});

describe('handle', () => {
  it('answers the preflight and refuses writes', async () => {
    const rpc = vi.fn();
    const options = await handle(request('/v1/vehicles', { method: 'OPTIONS' }), { rpc });
    expect(options.status).toBe(204);
    expect(options.headers.get('access-control-allow-headers')).toMatch(/X-API-Key/);
    const post = await handle(request('/v1/vehicles', { method: 'POST' }), { rpc });
    expect(post.status).toBe(405);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('serves the index and the OpenAPI document without a key', async () => {
    const rpc = vi.fn();
    const index = await (await handle(request('/v1'), { rpc })).json();
    expect(index.resources.map((r) => r.name)).toEqual(RESOURCE_NAMES);
    expect(index.resources[0].url).toBe(`${BASE}/v1/vehicles`);
    const spec = await (await handle(request('/v1/openapi.json?lang=he'), { rpc })).json();
    expect(spec.servers[0].url).toBe(`${BASE}/v1`);
    expect(spec.paths['/vehicles'].get.summary).toBe('רכבים');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects unknown resources and bad parameters before touching the database', async () => {
    const rpc = vi.fn();
    expect((await handle(request('/v1/profiles'), { rpc })).status).toBe(404);
    const bad = await handle(request('/v1/vehicles?limit=5000'), { rpc });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('bad_request');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps the authorization result to HTTP', async () => {
    const no = await handle(request('/v1/vehicles'), { rpc: rpcWith({ status: 401 }) });
    expect(no.status).toBe(401);
    expect(no.headers.get('www-authenticate')).toMatch(/Bearer/);
    const forbidden = await handle(request('/v1/vehicles'), { rpc: rpcWith({ status: 403 }) });
    expect(forbidden.status).toBe(403);
    const limited = await handle(request('/v1/vehicles'), {
      rpc: rpcWith({ status: 429, limit: 60, remaining: 0, reset: 1800000000, retry_after: 17 }),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('17');
    expect(limited.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('pages with the organization from the key, never from the request', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const rpc = rpcWith(okAuth, { data: rows, count: 2 });
    const response = await handle(
      request(`/v1/vehicles?limit=2&updated_since=2026-11-01&org_id=other`, {
        headers: { 'X-API-Key': KEY },
      }),
      { rpc },
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, 'api_authorize', { p_key: KEY, p_scope: 'read' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'api_v1_rows', {
      p_org: ORG,
      p_resource: 'vehicles',
      p_since: '2026-11-01T00:00:00.000Z',
      p_limit: 2,
      p_offset: 0,
    });
    expect(response.headers.get('x-ratelimit-limit')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.data).toEqual(rows);
    const next = new URL(body.next);
    expect(next.pathname).toBe('/functions/v1/public-api/v1/vehicles');
    expect(decodeCursor(next.searchParams.get('cursor'))).toBe(2);
    expect(next.searchParams.get('updated_since')).toBe('2026-11-01T00:00:00.000Z');
  });

  it('ends paging on a short page', async () => {
    const rpc = rpcWith(okAuth, { data: [{ id: 3 }], count: 1 });
    const body = await (
      await handle(request(`/v1/vehicles?limit=2&cursor=${encodeCursor(2)}`), { rpc })
    ).json();
    expect(body).toEqual({ data: [{ id: 3 }], next_cursor: null, next: null });
    expect(rpc.mock.calls[1][1].p_offset).toBe(2);
  });

  it('does not leak database errors', async () => {
    const rpc = vi.fn(async () => {
      throw new Error('relation "secret_table" does not exist');
    });
    const response = await handle(request('/v1/vehicles'), { rpc });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret_table/);
  });
});

describe('the OpenAPI document', () => {
  it('describes every resource in both languages', () => {
    const he = buildOpenApi({ lang: 'he' });
    const en = buildOpenApi({ lang: 'en' });
    RESOURCE_NAMES.forEach((name) => {
      expect(he.paths[`/${name}`].get.summary).toBeTruthy();
      expect(en.paths[`/${name}`].get.summary).toBeTruthy();
      expect(he.paths[`/${name}`].get.summary).not.toBe(en.paths[`/${name}`].get.summary);
    });
    const ids = Object.values(en.paths).map((path) => path.get.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    Object.values(en.components.schemas).forEach((schema) => expect(schema.type).toBe('object'));
  });

  it('lists the same resources as the database', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../../../migrations/20261111100000_public_api.sql', import.meta.url)),
      'utf8',
    );
    const block = sql.slice(sql.indexOf('from (values'), sql.indexOf(') as r (name'));
    const names = [...block.matchAll(/\('([a-z_]+)', '/g)].map((match) => match[1]);
    expect(names).toEqual(RESOURCE_NAMES);
  });
});

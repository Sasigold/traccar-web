import { API_VERSION, DEFAULT_LIMIT, MAX_LIMIT, buildOpenApi } from './openapi.js';
import { RESOURCES, resourceOf } from './resources.js';
import { handleMcp } from './mcp.js';

// The public API gateway (INT-01), without Deno: `handle(request, { rpc })` answers a standard
// Request with a Response. `rpc(name, args)` calls a database function with the service role and
// resolves to its JSON result; the edge function (index.ts) supplies it. Every decision about what
// a key may see is made in the database (api_authorize, api_v1_rows).
//
//   GET /v1                    what is available
//   GET /v1/openapi.json       the OpenAPI document (?lang=he for Hebrew), no key needed
//   GET /v1/<resource>         a page of rows: ?limit=&cursor=&updated_since=
//   POST /v1/mcp               the same rows as MCP tools (AI-07, mcp.js)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, X-API-Key, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers':
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
};

const MESSAGES = {
  bad_request: 'Invalid request.',
  unauthorized: 'A valid API key is required (X-API-Key or Authorization: Bearer).',
  forbidden: 'This key may not do this.',
  rate_limited: 'Rate limit exceeded. Retry after the time in Retry-After.',
  not_found: 'No such resource.',
  method_not_allowed: 'Only GET is supported.',
  server_error: 'Something went wrong on our side. Try again later.',
};

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
      ...headers,
    },
  });

const error = (status, code, message = MESSAGES[code], headers = {}) =>
  json(status, { error: { code, message } }, headers);

// The path after the version, wherever the function is mounted (/public-api/v1/x, or
// /functions/v1/public-api/v1/x when the prefix is not stripped): the last "v1" segment counts.
const versionAt = (parts) => parts.lastIndexOf(API_VERSION);

export const routeOf = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  const at = versionAt(parts);
  return at < 0 ? null : parts.slice(at + 1).join('/');
};

// The public address of /v1 for links in answers. Behind Kong the function sees an internal
// address, so a configured URL wins, then the X-Forwarded-* headers, then the request itself.
export const publicBase = (request, configured) => {
  if (configured) {
    return `${configured.replace(/\/+$/, '')}/${API_VERSION}`;
  }
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const mount = `/${parts.slice(0, Math.max(0, versionAt(parts))).join('/')}`.replace(/\/$/, '');
  const first = (name) => (request.headers.get(name) || '').split(',')[0].trim();
  const host = first('x-forwarded-host');
  const origin = host ? `${first('x-forwarded-proto') || 'https'}://${host}` : url.origin;
  const prefix = first('x-forwarded-prefix').replace(/\/+$/, '');
  return `${origin}${prefix && !mount.startsWith(prefix) ? prefix : ''}${mount}/${API_VERSION}`;
};

export const keyOf = (headers) => {
  const direct = headers.get('x-api-key');
  if (direct) {
    return direct.trim();
  }
  const match = /^Bearer\s+(.+)$/i.exec(headers.get('authorization') || '');
  return match ? match[1].trim() : null;
};

// Cursors are opaque to clients: the offset of the next page, base64url.
export const encodeCursor = (offset) =>
  btoa(String(offset)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const decodeCursor = (cursor) => {
  if (!cursor) {
    return 0;
  }
  try {
    const value = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    return /^\d{1,9}$/.test(value) ? Number(value) : null;
  } catch {
    return null;
  }
};

// { limit, offset, since } or { error } for the query of a list request.
export const parseQuery = (params) => {
  const rawLimit = params.get('limit');
  const limit = rawLimit == null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be a whole number from 1 to ${MAX_LIMIT}.` };
  }
  const offset = decodeCursor(params.get('cursor'));
  if (offset == null) {
    return { error: 'cursor is not valid; use next_cursor from the previous page.' };
  }
  const rawSince = params.get('updated_since');
  let since = null;
  if (rawSince) {
    const time = Date.parse(rawSince);
    if (!/^\d{4}-\d{2}-\d{2}/.test(rawSince) || Number.isNaN(time)) {
      return { error: 'updated_since must be an ISO 8601 date or time.' };
    }
    since = new Date(time).toISOString();
  }
  return { limit, offset, since };
};

const rateHeaders = (auth) =>
  auth?.limit != null
    ? {
        'X-RateLimit-Limit': String(auth.limit),
        'X-RateLimit-Remaining': String(Math.max(0, auth.remaining ?? 0)),
        'X-RateLimit-Reset': String(auth.reset ?? ''),
      }
    : {};

// A page of rows for a key's organization, as the REST list and the MCP tools return it.
const pageOf = async (rpc, orgId, resource, query) => {
  const page = await rpc('api_v1_rows', {
    p_org: orgId,
    p_resource: resource,
    p_since: query.since,
    p_limit: query.limit,
    p_offset: query.offset,
  });
  if (!page) return null;
  const data = page.data ?? [];
  const nextCursor = data.length === query.limit ? encodeCursor(query.offset + data.length) : null;
  return { data, nextCursor };
};

const rpcError = (id, code, message, status = 200) =>
  json(status, { jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// AI-07: one JSON-RPC message per POST, answered with JSON (no event stream, no session).
const handleMcpRequest = async (request, rpc) => {
  if (request.method !== 'POST') {
    return error(405, 'method_not_allowed', 'Use POST for MCP messages.', {
      Allow: 'POST, OPTIONS',
    });
  }
  let message;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, 'Parse error.', 400);
  }
  if (Array.isArray(message)) {
    return rpcError(null, -32600, 'Send one message per request.', 400);
  }
  try {
    const auth = await rpc('api_authorize', { p_key: keyOf(request.headers), p_scope: 'read' });
    if (Number(auth?.status) === 401) {
      return error(401, 'unauthorized', MESSAGES.unauthorized, {
        'WWW-Authenticate': 'Bearer realm="viper fleet"',
      });
    }
    const answer = await handleMcp(message, {
      authorize: async () => auth,
      rows: async (resource, params) => {
        const query = parseQuery(params);
        if (query.error) return { error: query.error };
        const page = await pageOf(rpc, auth.org_id, resource, query);
        return page ? { data: page.data, next_cursor: page.nextCursor } : { error: 'Not found.' };
      },
    });
    if (answer == null) {
      return new Response(null, { status: 202, headers: CORS });
    }
    return json(200, answer, rateHeaders(auth));
  } catch {
    return rpcError(message?.id, -32603, MESSAGES.server_error);
  }
};

export const handle = async (request, { rpc, publicUrl = null }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  const url = new URL(request.url);
  const route = routeOf(url.pathname);
  if (route == null) {
    return error(404, 'not_found', `Use /${API_VERSION}/<resource>.`);
  }
  if (route === 'mcp') {
    return handleMcpRequest(request, rpc);
  }
  if (request.method !== 'GET') {
    return error(405, 'method_not_allowed', MESSAGES.method_not_allowed, { Allow: 'GET, OPTIONS' });
  }

  const base = publicBase(request, publicUrl);

  if (route === 'openapi.json') {
    return json(200, buildOpenApi({ lang: url.searchParams.get('lang'), serverUrl: base }));
  }
  if (route === '') {
    return json(200, {
      version: API_VERSION,
      openapi: `${base}/openapi.json`,
      resources: RESOURCES.map((resource) => ({
        name: resource.name,
        title: resource.en.title,
        url: `${base}/${resource.name}`,
      })),
    });
  }

  const resource = resourceOf(route);
  if (!resource) {
    return error(404, 'not_found');
  }
  const query = parseQuery(url.searchParams);
  if (query.error) {
    return error(400, 'bad_request', query.error);
  }

  try {
    const auth = await rpc('api_authorize', { p_key: keyOf(request.headers), p_scope: 'read' });
    const status = Number(auth?.status);
    if (status === 401) {
      return error(401, 'unauthorized', MESSAGES.unauthorized, {
        'WWW-Authenticate': 'Bearer realm="viper fleet"',
      });
    }
    if (status === 403) {
      return error(403, 'forbidden');
    }
    if (status === 429) {
      return error(429, 'rate_limited', MESSAGES.rate_limited, {
        ...rateHeaders(auth),
        'Retry-After': String(auth.retry_after ?? 60),
      });
    }
    if (status !== 200 || !auth.org_id) {
      return error(500, 'server_error');
    }

    const page = await pageOf(rpc, auth.org_id, resource.name, query);
    if (!page) {
      return error(404, 'not_found');
    }
    const { data, nextCursor } = page;
    let next = null;
    if (nextCursor) {
      const nextUrl = new URL(`${base}/${resource.name}`);
      nextUrl.searchParams.set('limit', String(query.limit));
      nextUrl.searchParams.set('cursor', nextCursor);
      if (query.since) {
        nextUrl.searchParams.set('updated_since', query.since);
      }
      next = nextUrl.toString();
    }
    return json(200, { data, next_cursor: nextCursor, next }, rateHeaders(auth));
  } catch {
    return error(500, 'server_error');
  }
};

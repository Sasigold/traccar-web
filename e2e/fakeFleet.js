import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { FLEET } from './fixtures';

// A fake fleet database for full e2e scenarios (FND-07): the fake traccar-auth, a subset of
// PostgREST (select with embeds and filters, insert, upsert, update, delete, rpc) and Storage
// (upload, signed URLs), all in memory for one test. Row security is not modelled here; it is
// tested against Postgres in supabase/tests.
//
//   const fleet = await fakeFleet(page, { users: { 1: { profile, permissions } }, tables });
//   fleet.tables.work_orders       the rows, to check what was saved
//   fleet.requests                 every request: { method, path, auth }
//   fleet.files                    uploads: path -> { type, body }
//
// With `orgScoped: true`, reads return only rows of the caller's organization, as row security
// would: the token says who asks, so a request sent with the wrong user's token shows up as the
// wrong data.

// The demo's write mode (demo/sandbox.js): this test's own sandbox, signed in as the admin.
export const writeMode = async (page, name = randomUUID()) => {
  await page
    .context()
    .addCookies([{ name: 'demoWrite', value: name, url: 'http://localhost:3000' }]);
  return name;
};

// The file in a multipart upload (storage-js sends a Blob as form data).
const fileOf = (contentType, body) => {
  const boundary = /boundary=([^;]+)/.exec(contentType || '')?.[1];
  if (!boundary) {
    return { type: contentType, body };
  }
  const delimiter = Buffer.from(`--${boundary}`);
  let start = body.indexOf(delimiter);
  while (start >= 0) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next < 0) break;
    const part = body.subarray(start + delimiter.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const headers = part.subarray(0, split).toString();
    if (/filename=/.test(headers)) {
      return {
        type: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] || 'application/octet-stream',
        body: part.subarray(split + 4),
      };
    }
    start = next;
  }
  return { type: contentType, body };
};

const singular = (name) => name.replace(/ies$/, 'y').replace(/s$/, '');

// "*, vendors(name), vehicles!inner(plate)" -> [{ name: 'vendors', inner: false }, ...]
const parseEmbeds = (select) => {
  const embeds = [];
  let depth = 0;
  let token = '';
  `${select || '*'},`.split('').forEach((char) => {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      const match = /^\s*(?:\w+:)?(\w+)(!inner)?\s*\(/.exec(token);
      if (match) embeds.push({ name: match[1], inner: Boolean(match[2]) });
      token = '';
    } else {
      token += char;
    }
  });
  return embeds;
};

const compare = (value, operator, operand) => {
  const text = value == null ? null : String(value);
  switch (operator) {
    case 'eq':
      return text === operand;
    case 'neq':
      return text !== operand;
    case 'gt':
      return value > Number(operand) || text > operand;
    case 'gte':
      return value >= Number(operand) || text >= operand;
    case 'lt':
      return value < Number(operand) || text < operand;
    case 'lte':
      return value <= Number(operand) || text <= operand;
    case 'is':
      return operand === 'null' ? value == null : String(value) === operand;
    case 'in':
      return operand
        .replace(/^\(|\)$/g, '')
        .split(',')
        .includes(text);
    case 'ilike':
    case 'like':
      return new RegExp(
        `^${operand.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
        'i',
      ).test(text || '');
    default:
      return true;
  }
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or']);

export const fakeFleet = async (
  page,
  { users = {}, tables = {}, rpc = {}, defaults = {}, orgScoped = false } = {},
) => {
  const state = {
    tables: Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
    ),
    files: new Map(),
    removedFiles: [],
    requests: [],
    counters: {},
  };
  const rowsOf = (table) => (state.tables[table] ||= []);

  const embed = (table, row, embeds) => {
    const result = { ...row };
    for (const { name, inner } of embeds) {
      const key = `${singular(name)}_id`;
      if (key in row) {
        result[name] = rowsOf(name).find((item) => item.id === row[key]) || null;
        if (inner && !result[name]) return null;
      } else {
        const back = `${singular(table)}_id`;
        result[name] = rowsOf(name).filter((item) => item[back] === row.id);
      }
    }
    return result;
  };

  const filtersOf = (params) =>
    [...params.entries()]
      .filter(([key]) => !RESERVED.has(key))
      .map(([key, raw]) => {
        const negate = raw.startsWith('not.');
        const value = negate ? raw.slice(4) : raw;
        const match = /^(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/s.exec(value);
        const [operator, operand] = match ? [match[1], match[2]] : ['eq', value];
        const path = key.split('.');
        return (row) => {
          const target = path.length > 1 ? row[path[0]]?.[path[1]] : row[key];
          const ok = compare(target, operator, operand);
          return negate ? !ok : ok;
        };
      });

  const withDefaults = (table, row) => {
    const now = new Date().toISOString();
    const base = { id: randomUUID(), created_at: now, updated_at: now };
    if (table === 'work_orders' || table === 'incidents') {
      state.counters[table] = (state.counters[table] || 1000) + 1;
      base.number = state.counters[table];
      if (table === 'work_orders') base.opened_at = now;
    }
    return { ...base, ...(defaults[table] || {}), ...row };
  };

  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const rest = async (route, request, url) => {
    const [, , , table] = url.pathname.split('/');
    const params = url.searchParams;
    const method = request.method();
    const single = (request.headers().accept || '').includes('vnd.pgrst.object');
    const embeds = parseEmbeds(params.get('select'));
    const filters = filtersOf(params);
    const view = (row) => embed(table, row, embeds);
    const answer = (rows) => {
      if (single) {
        return rows.length === 1
          ? json(route, rows[0])
          : json(
              route,
              {
                code: 'PGRST116',
                message: 'JSON object requested, multiple (or no) rows returned',
              },
              406,
            );
      }
      return json(route, rows);
    };

    if (method === 'GET' || method === 'HEAD') {
      const caller = users[/^Bearer jwt-(\d+)$/.exec(request.headers().authorization || '')?.[1]];
      let rows = rowsOf(table)
        .filter((row) => !orgScoped || !('org_id' in row) || row.org_id === caller?.profile.org_id)
        .map(view)
        .filter(Boolean)
        .filter((row) => filters.every((test) => test(row)));
      const order = params.get('order');
      if (order) {
        const [column, direction] = order.split(',')[0].split('.');
        rows = [...rows].sort(
          (a, b) =>
            (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) *
            (direction === 'desc' ? -1 : 1),
        );
      }
      if (params.get('limit')) rows = rows.slice(0, Number(params.get('limit')));
      return answer(rows);
    }
    if (method === 'POST') {
      const body = request.postDataJSON();
      const prefer = request.headers().prefer || '';
      const conflict = params.get('on_conflict');
      const saved = [body].flat().map((row) => {
        if (conflict && prefer.includes('merge-duplicates')) {
          const keys = conflict.split(',');
          const existing = rowsOf(table).find((item) =>
            keys.every((key) => String(item[key]) === String(row[key])),
          );
          if (existing)
            return Object.assign(existing, row, { updated_at: new Date().toISOString() });
        }
        const added = withDefaults(table, row);
        rowsOf(table).push(added);
        return added;
      });
      return prefer.includes('return=representation')
        ? answer(saved.map(view))
        : route.fulfill({ status: 201, body: '' });
    }
    if (method === 'PATCH') {
      const changes = request.postDataJSON();
      const matched = rowsOf(table).filter((row) => filters.every((test) => test(view(row))));
      matched.forEach((row) =>
        Object.assign(row, changes, { updated_at: new Date().toISOString() }),
      );
      return (request.headers().prefer || '').includes('return=representation')
        ? answer(matched.map(view))
        : route.fulfill({ status: 204, body: '' });
    }
    if (method === 'DELETE') {
      state.tables[table] = rowsOf(table).filter(
        (row) => !filters.every((test) => test(view(row))),
      );
      return route.fulfill({ status: 204, body: '' });
    }
    return json(route, { message: 'unsupported' }, 400);
  };

  const storage = async (route, request, url) => {
    const path = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\//, ''));
    // Signed URL: POST object/sign/<bucket>/<path> -> { signedURL }, then GET it.
    if (path.startsWith('object/sign/')) {
      const key = path.replace(/^object\/sign\/[^/]+\//, '');
      if (request.method() === 'POST') {
        return json(route, { signedURL: `/object/sign/files/${key}?token=fake` });
      }
      const file = state.files.get(key);
      return file
        ? route.fulfill({ status: 200, contentType: file.type, body: file.body })
        : route.fulfill({ status: 404, body: '' });
    }
    // Bulk delete: DELETE object/<bucket> { prefixes: [paths] }.
    if (path.startsWith('object/') && request.method() === 'DELETE') {
      const { prefixes = [] } = request.postDataJSON() || {};
      const removed = prefixes.filter((key) => state.files.delete(key));
      state.removedFiles.push(...prefixes);
      return json(
        route,
        removed.map((name) => ({ name })),
      );
    }
    if (path.startsWith('object/') && request.method() === 'POST') {
      const key = path.replace(/^object\/[^/]+\//, '');
      state.files.set(key, fileOf(request.headers()['content-type'], request.postDataBuffer()));
      return json(route, { Key: key });
    }
    return json(route, { message: 'unsupported' }, 400);
  };

  await page.route(`${FLEET}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push({
      method: request.method(),
      path: url.pathname + url.search,
      auth: request.headers().authorization,
    });
    if (url.pathname === '/functions/v1/traccar-auth') {
      const token = request.postDataJSON()?.token || '';
      const userId = /^demo-token-(\d+)$/.exec(token)?.[1];
      const user = users[userId];
      if (!user) {
        return json(route, { error: 'invalid token' }, 401);
      }
      return json(route, {
        access_token: `jwt-${userId}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        profile: user.profile,
        permissions: user.permissions,
      });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop();
      const handler = rpc[name];
      const result =
        typeof handler === 'function'
          ? await handler(request.postDataJSON(), state)
          : (handler ?? null);
      return json(route, result);
    }
    if (url.pathname.startsWith('/rest/v1/')) return rest(route, request, url);
    if (url.pathname.startsWith('/storage/v1/')) return storage(route, request, url);
    return json(route, { message: 'not found' }, 404);
  });
  return state;
};

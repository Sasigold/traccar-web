// Write mode for the demo server (FND-07). The demo is read-only, so e2e tests could not save
// anything. A request with the cookie `demoWrite=<name>` works in its own sandbox instead:
//
//   - writes (POST / PUT / DELETE on /api/<collection>[/<id>]) are kept in memory, per sandbox,
//     and later reads of that sandbox see them; other tests and plain demo visitors never do
//   - signing in and out works: POST /api/session (form email / password), DELETE /api/session,
//     POST /api/session/token (a token naming the user, for the fake traccar-auth in e2e)
//   - the users are not read-only, and the server allows writes
//
// Without the cookie nothing changes: the demo stays read-only. Tests set the cookie with
// `writeMode(page)` from e2e/fakeFleet.js.

export const DEMO_USERS = [
  {
    id: 1,
    name: 'Demo',
    email: 'admin@demo.invalid',
    administrator: true,
    readonly: false,
    attributes: {},
  },
  {
    id: 2,
    name: 'דנה לוי',
    email: 'dana@demo.invalid',
    administrator: false,
    readonly: false,
    attributes: {},
  },
];
export const DEMO_PASSWORD = 'demo';

const sandboxes = new Map();

export const sandboxOf = (request) => {
  const name = /(?:^|;\s*)demoWrite=([\w-]{1,64})/.exec(request.headers.cookie || '')?.[1];
  if (!name) {
    return null;
  }
  if (!sandboxes.has(name)) {
    sandboxes.set(name, {
      name,
      // null: signed out; otherwise the user id. A new sandbox starts signed in as the admin.
      userId: 1,
      nextId: 100000,
      added: {},
      changed: {},
      removed: {},
    });
  }
  return sandboxes.get(name);
};

export const readBody = (request) =>
  new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const type = request.headers['content-type'] || '';
      if (!body) {
        resolve({});
      } else if (type.includes('application/json')) {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      } else {
        resolve(Object.fromEntries(new URLSearchParams(body)));
      }
    });
  });

// The sandbox's view of a collection: the demo's items with its additions, changes and removals.
export const overlay = (sandbox, collection, items) => {
  if (!sandbox || !Array.isArray(items)) {
    return items;
  }
  const changed = sandbox.changed[collection] || {};
  const removed = sandbox.removed[collection] || new Set();
  return [...items, ...(sandbox.added[collection] || [])]
    .filter((item) => !removed.has(item.id))
    .map((item) => (changed[item.id] ? { ...item, ...changed[item.id] } : item));
};

export const overlayOne = (sandbox, collection, item, id) => {
  if (!sandbox) {
    return item;
  }
  const added = (sandbox.added[collection] || []).find((it) => it.id === id);
  if (sandbox.removed[collection]?.has(id)) {
    return undefined;
  }
  const base = item || added;
  const change = sandbox.changed[collection]?.[id];
  return base && change ? { ...base, ...change } : base;
};

// Session endpoints in write mode. Returns true when it answered.
const session = async (sandbox, request, response, url, send) => {
  if (url.pathname === '/api/session/token' && request.method === 'POST') {
    if (sandbox.userId == null) {
      response.writeHead(401).end('Not signed in.');
    } else {
      response.end(`demo-token-${sandbox.userId}`);
    }
    return true;
  }
  // "Log in as" another user (SEC-13): GET /api/session/<id> switches the sandbox's session.
  const switchTo = /^\/api\/session\/(\d+)$/.exec(url.pathname);
  if (switchTo && request.method === 'GET') {
    const user = DEMO_USERS.find((item) => item.id === Number(switchTo[1]));
    if (sandbox.userId == null || !user) {
      response.writeHead(404).end('Unknown user.');
    } else {
      sandbox.userId = user.id;
      send(user);
    }
    return true;
  }
  if (url.pathname !== '/api/session') {
    return false;
  }
  if (request.method === 'GET') {
    const user = DEMO_USERS.find((item) => item.id === sandbox.userId);
    if (user) {
      send(user);
    } else {
      response.writeHead(404).end('Not signed in.');
    }
    return true;
  }
  if (request.method === 'DELETE') {
    sandbox.userId = null;
    response.writeHead(204).end();
    return true;
  }
  if (request.method === 'POST') {
    const { email, password } = await readBody(request);
    const user = DEMO_USERS.find((item) => item.email === email);
    if (!user || password !== DEMO_PASSWORD) {
      response.writeHead(401).end('Wrong e-mail or password.');
      return true;
    }
    sandbox.userId = user.id;
    send(user);
    return true;
  }
  return false;
};

// Writes in write mode. Returns true when it answered.
export const handleSandbox = async (sandbox, request, response, url, send) => {
  if (await session(sandbox, request, response, url, send)) {
    return true;
  }
  if (request.method === 'GET') {
    return false;
  }
  if (sandbox.userId == null) {
    response.writeHead(401).end('Not signed in.');
    return true;
  }
  const match = /^\/api\/([a-z]+(?:\/[a-z]+)?)(?:\/(\d+))?$/.exec(url.pathname);
  if (!match) {
    return false;
  }
  const [, collection, rawId] = match;
  const id = rawId ? Number(rawId) : null;
  // Links between users and items: accepted, nothing to show.
  if (collection === 'permissions' || collection === 'permissions/bulk') {
    response.writeHead(204).end();
    return true;
  }
  const body = request.method === 'DELETE' ? {} : await readBody(request);
  if (request.method === 'POST' && id == null) {
    sandbox.nextId += 1;
    const item = { attributes: {}, ...body, id: sandbox.nextId };
    (sandbox.added[collection] ||= []).push(item);
    send(item);
    return true;
  }
  if (request.method === 'PUT' && id != null) {
    const added = (sandbox.added[collection] || []).find((item) => item.id === id);
    if (added) {
      Object.assign(added, body, { id });
    } else {
      (sandbox.changed[collection] ||= {})[id] = { ...body, id };
    }
    send({ ...body, id });
    return true;
  }
  if (request.method === 'DELETE' && id != null) {
    (sandbox.removed[collection] ||= new Set()).add(id);
    response.writeHead(204).end();
    return true;
  }
  return false;
};

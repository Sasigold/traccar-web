// ADM-10: what the driver sends waits in the device until it is through. Each send is kept in
// IndexedDB (photos as Blobs) and done in steps that are safe to repeat: the rows carry ids made
// here, so a retry after a lost answer finds them instead of adding a second report, and a photo
// goes up under a fixed path. A step that is done is written down before the next one starts.
//
// Kinds register a handler: `registerOutboxKind(kind, async (item, mark) => …)`; `mark(changes)`
// saves the item's progress. A handler throws to leave the item for the next try.

const DB_NAME = 'viper-outbox';
const STORE = 'items';
const EVENT = 'viper-outbox';

const handlers = new Map();
export const registerOutboxKind = (kind, handler) => handlers.set(kind, handler);

// ─── storage ────────────────────────────────────────────────────────────────

const memoryStore = () => {
  const items = new Map();
  return {
    all: async () => [...items.values()].map((item) => ({ ...item })),
    put: async (item) => {
      items.set(item.id, { ...item });
    },
    remove: async (id) => {
      items.delete(id);
    },
  };
};

const request = (value) =>
  new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });

const indexedStore = () => {
  let opening;
  const open = () => {
    opening ??= new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DB_NAME, 1);
      openRequest.onupgradeneeded = () =>
        openRequest.result.createObjectStore(STORE, { keyPath: 'id' });
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    return opening;
  };
  const run = async (mode, action) => {
    const db = await open();
    return request(action(db.transaction(STORE, mode).objectStore(STORE)));
  };
  return {
    all: () => run('readonly', (store) => store.getAll()),
    put: (item) => run('readwrite', (store) => store.put(item)),
    remove: (id) => run('readwrite', (store) => store.delete(id)),
  };
};

let store = typeof indexedDB !== 'undefined' ? indexedStore() : memoryStore();
// Tests use a store in memory.
export const memoryOutboxForTests = () => {
  store = memoryStore();
};

const changed = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
};
export const onOutboxChange = (listener) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

// ─── the queue ──────────────────────────────────────────────────────────────

export const newId = () => crypto.randomUUID();

export const listOutbox = async () =>
  (await store.all()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const enqueue = async (kind, payload, files = []) => {
  const item = {
    id: newId(),
    kind,
    createdAt: new Date().toISOString(),
    payload,
    files: files.map((file) => ({ id: newId(), ...file, done: false })),
    attempts: 0,
    error: null,
  };
  await store.put(item);
  changed();
  return item;
};

// A lost answer to an insert that went through comes back as a duplicate key: it is done.
export const alreadySaved = (error) => error?.code === '23505';

const running = new Map();

// Sends one item. Resolves to { sent: true } or { sent: false, error, item, filesLeft }.
export const sendItem = async (item) => {
  if (running.has(item.id)) return running.get(item.id);
  const work = (async () => {
    const handler = handlers.get(item.kind);
    // The stored item has the progress of earlier tries.
    const stored = (await store.all()).find((value) => value.id === item.id);
    if (!stored) return { sent: true };
    const current = { ...stored, attempts: stored.attempts + 1 };
    const mark = async (changes) => {
      Object.assign(current, changes);
      await store.put(current);
      changed();
    };
    try {
      if (!handler) throw new Error(`No sender for ${item.kind}`);
      await handler(current, mark);
      await store.remove(item.id);
      changed();
      return { sent: true };
    } catch (error) {
      await mark({ error: error?.message || String(error) });
      return {
        sent: false,
        error,
        item: current,
        filesLeft: current.files.filter((file) => !file.done).length,
      };
    } finally {
      running.delete(item.id);
    }
  })();
  running.set(item.id, work);
  return work;
};

export const flushOutbox = async () => {
  const items = await listOutbox();
  const results = [];
  for (const item of items) {
    results.push(await sendItem(item));
  }
  return results;
};

// Files of an item go up a few at a time; each is marked done as soon as it is through.
export const sendFiles = async (item, mark, send, limit = 3) => {
  const queue = item.files.filter((file) => !file.done);
  const failures = [];
  const worker = async () => {
    while (queue.length) {
      const file = queue.shift();
      try {
        await send(file);
        file.done = true;
        await mark({ files: item.files });
      } catch (error) {
        failures.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
  if (failures.length) {
    const error = new Error(failures[0]?.message || 'upload failed');
    error.filesLeft = failures.length;
    throw error;
  }
};

// ─── photos ─────────────────────────────────────────────────────────────────

// A photo is made at most `max` px on its long side (JPEG) before it is stored. Anything that is
// not an image, or a browser without canvas, keeps the original.
export const shrinkImage = async (file, max = 1600) => {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') return file;
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
};

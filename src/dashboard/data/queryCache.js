// A small shared cache for dashboard data. Many widgets subscribe to the same key and
// share one request; while a key reloads, its previous data stays available (marked
// stale) so charts don't flash. A request nobody listens to anymore is aborted, and
// unused entries are dropped after a while. Framework-free; React binds through
// useSyncExternalStore.

const GC_DELAY = 5 * 60000;

export const createQueryCache = ({ now = () => Date.now(), gcDelay = GC_DELAY } = {}) => {
  const entries = new Map();

  const emptyEntry = (key) => ({
    key,
    status: 'idle',
    data: undefined,
    error: null,
    updatedAt: 0,
    stale: false,
  });

  const state = (key) => {
    if (!entries.has(key)) {
      entries.set(key, {
        snapshot: emptyEntry(key),
        listeners: new Set(),
        controller: null,
        timer: null,
      });
    }
    return entries.get(key);
  };

  const update = (key, patch) => {
    const entry = state(key);
    entry.snapshot = { ...entry.snapshot, ...patch };
    entry.listeners.forEach((listener) => listener());
  };

  const get = (key) => state(key).snapshot;

  const scheduleGc = (key) => {
    const entry = state(key);
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (!entry.listeners.size) {
        entry.controller?.abort();
        entries.delete(key);
      }
    }, gcDelay);
  };

  const subscribe = (key, listener) => {
    const entry = state(key);
    entry.listeners.add(listener);
    clearTimeout(entry.timer);
    return () => {
      entry.listeners.delete(listener);
      if (!entry.listeners.size) {
        if (entry.snapshot.status === 'loading') {
          entry.controller?.abort();
          entry.controller = null;
          entry.snapshot = {
            ...entry.snapshot,
            status: entry.snapshot.data === undefined ? 'idle' : 'success',
          };
        }
        scheduleGc(key);
      }
    };
  };

  // Loads `key` unless fresh data (younger than maxAge) or a request is already there.
  const ensure = (key, loader, { maxAge = Infinity, force = false } = {}) => {
    const entry = state(key);
    const { snapshot } = entry;
    if (snapshot.status === 'loading') {
      return;
    }
    const fresh = snapshot.status === 'success' && now() - snapshot.updatedAt < maxAge;
    if (fresh && !force) {
      return;
    }
    if (snapshot.status === 'error' && !force && now() - snapshot.updatedAt < maxAge) {
      return;
    }
    const controller = new AbortController();
    entry.controller = controller;
    update(key, { status: 'loading', stale: snapshot.data !== undefined, error: null });
    Promise.resolve()
      .then(() => loader(controller.signal))
      .then((data) => {
        if (entry.controller === controller) {
          entry.controller = null;
          update(key, { status: 'success', data, error: null, updatedAt: now(), stale: false });
        }
      })
      .catch((error) => {
        if (entry.controller === controller) {
          entry.controller = null;
          if (error?.name === 'AbortError') {
            update(key, { status: snapshot.data === undefined ? 'idle' : 'success', stale: false });
          } else {
            update(key, { status: 'error', error, updatedAt: now(), stale: false });
          }
        }
      });
  };

  // Marks everything for reload on the next ensure (manual refresh).
  const invalidate = () => {
    entries.forEach((entry, key) => {
      if (entry.snapshot.status !== 'loading') {
        entry.snapshot = { ...entry.snapshot, updatedAt: 0 };
        entries.set(key, entry);
      }
    });
  };

  const latestUpdate = () =>
    Math.max(
      0,
      ...[...entries.values()]
        .filter((entry) => entry.snapshot.status === 'success')
        .map((entry) => entry.snapshot.updatedAt),
    );

  return { get, subscribe, ensure, invalidate, latestUpdate, size: () => entries.size };
};

// Traccar report requests for many vehicles: ids are sent in chunks (Traccar needs
// explicit deviceId/groupId), at most a few requests run at once, and results are
// merged. A size guard refuses requests that would return too many rows. Pure: the
// fetch function is injected.

export const CHUNK_SIZE = 100;
export const CONCURRENCY = 3;

// Rough upper bounds on devices × days per source.
export const LIMITS = {
  summary: 200000,
  summaryDaily: 20000,
  trips: 3000,
  stops: 3000,
  events: 1500,
};

export class TooLargeError extends Error {
  constructor(source) {
    super(`too large: ${source}`);
    this.name = 'TooLargeError';
    this.source = source;
  }
}

export const chunk = (list, size = CHUNK_SIZE) => {
  const result = [];
  for (let index = 0; index < list.length; index += size) {
    result.push(list.slice(index, index + size));
  }
  return result;
};

export const reportUrl = (endpoint, { from, to, deviceIds, params = {} }) => {
  const query = new URLSearchParams({ from, to });
  deviceIds.forEach((id) => query.append('deviceId', id));
  Object.entries(params).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((item) => query.append(key, String(item)));
  });
  return `api/reports/${endpoint}?${query.toString()}`;
};

export const checkSize = (sourceKey, deviceCount, dayCount) => {
  const limit = LIMITS[sourceKey];
  if (limit && deviceCount * dayCount > limit) {
    throw new TooLargeError(sourceKey);
  }
};

// Runs `tasks` (functions returning promises) with limited concurrency, keeping order.
export const runLimited = async (tasks, limit = CONCURRENCY) => {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
};

export const fetchReport = async ({ endpoint, from, to, deviceIds, params, signal, fetchJson }) => {
  if (!deviceIds.length) {
    return [];
  }
  const tasks = chunk(deviceIds).map(
    (ids) => () => fetchJson(reportUrl(endpoint, { from, to, deviceIds: ids, params }), { signal }),
  );
  const parts = await runLimited(tasks);
  return parts.flat();
};

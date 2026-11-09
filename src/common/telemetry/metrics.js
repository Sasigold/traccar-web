// The browser's own measurements (FND-06), kept in memory and sent in batches to the fleet
// database (record_client_metrics): web vitals, long tasks, and operational counters such as
// socket disconnects, fleet-token failures, chunk-load errors and Supabase error codes. Pure; the
// sending lives in install.js. Nothing personal: names, numbers and the page as a template.

export const VITALS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
const RATINGS = ['good', 'needs-improvement', 'poor'];
const NAME = /^[a-z][a-z0-9_.]{0,59}$/;

// A counter name from free text: "fleet_error." + "PGRST301" -> "fleet_error.pgrst301".
export const counterName = (prefix, detail) => {
  const suffix = String(detail ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return suffix ? `${prefix}.${suffix}` : prefix;
};

export const createMetricsBuffer = ({ maxVitals = 100, maxCounters = 50 } = {}) => {
  let counters = {};
  let vitals = [];
  let longTasks = { count: 0, totalMs: 0, maxMs: 0 };

  const buffer = {
    count(name, amount = 1) {
      if (!NAME.test(name) || !(amount > 0)) {
        return;
      }
      if (!(name in counters) && Object.keys(counters).length >= maxCounters) {
        return;
      }
      counters[name] = (counters[name] || 0) + amount;
    },
    vital({ name, value, rating, route }) {
      if (
        !VITALS.includes(name) ||
        !Number.isFinite(value) ||
        value < 0 ||
        vitals.length >= maxVitals
      ) {
        return;
      }
      vitals.push({
        name,
        value: Math.round(value * 1000) / 1000,
        rating: RATINGS.includes(rating) ? rating : null,
        route: route || '/',
      });
    },
    longTask(duration) {
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      longTasks.count += 1;
      longTasks.totalMs += duration;
      longTasks.maxMs = Math.max(longTasks.maxMs, duration);
    },
    isEmpty() {
      return !Object.keys(counters).length && !vitals.length && !longTasks.count;
    },
    // The batch to send; the buffer starts over.
    take() {
      const batch = {
        counters,
        vitals,
        longtasks: {
          count: longTasks.count,
          total_ms: Math.round(longTasks.totalMs),
          max_ms: Math.round(longTasks.maxMs),
        },
      };
      counters = {};
      vitals = [];
      longTasks = { count: 0, totalMs: 0, maxMs: 0 };
      return batch;
    },
    // A batch that could not be sent goes back, within the same limits.
    restore(batch) {
      Object.entries(batch.counters || {}).forEach(([name, amount]) => buffer.count(name, amount));
      (batch.vitals || []).forEach((sample) => buffer.vital(sample));
      if (batch.longtasks?.count) {
        longTasks.count += batch.longtasks.count;
        longTasks.totalMs += batch.longtasks.total_ms;
        longTasks.maxMs = Math.max(longTasks.maxMs, batch.longtasks.max_ms);
      }
    },
  };
  return buffer;
};

// The app's buffer. Modules that only count (session.js, the socket) import this file alone, so
// counting never pulls the senders in, and never creates an import cycle.
export const metrics = createMetricsBuffer();

export const countEvent = (name, amount) => metrics.count(name, amount);

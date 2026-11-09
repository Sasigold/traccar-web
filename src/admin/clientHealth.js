// The interface health screen (FND-06): turns client_metrics_overview rows into what the screen
// shows. Pure, unit-tested.

// Google's thresholds for the 75th percentile: good up to the first value, poor above the second.
export const VITAL_THRESHOLDS = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export const VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

export const vitalRating = (name, value) => {
  const thresholds = VITAL_THRESHOLDS[name];
  if (!thresholds || value == null || !Number.isFinite(Number(value))) {
    return null;
  }
  if (value <= thresholds[0]) {
    return 'good';
  }
  return value <= thresholds[1] ? 'needs-improvement' : 'poor';
};

// Milliseconds, shown in seconds from one second up.
export const formatDuration = (value, language = 'he') => {
  if (value == null) {
    return '–';
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString(language, { maximumFractionDigits: 2 })} s`;
  }
  return `${Math.round(value).toLocaleString(language)} ms`;
};

// CLS has no unit; the others are durations.
export const formatVital = (name, value, language = 'he') => {
  if (value != null && name === 'CLS') {
    return Number(value).toLocaleString(language, { maximumFractionDigits: 3 });
  }
  return formatDuration(value, language);
};

// "{0} in total, longest {1}" with nodes in place of {0}, {1}: a list for React.
export const fill = (template, values) =>
  String(template)
    .split(/(\{\d\})/)
    .filter((part) => part !== '')
    .map((part) => {
      const match = /^\{(\d)\}$/.exec(part);
      return match ? values[Number(match[1])] : part;
    });

// Releases newest first (the overview is ordered by the last report).
export const releasesOf = (rows) => {
  const seen = [];
  (rows || []).forEach((row) => {
    if (!seen.includes(row.release)) {
      seen.push(row.release);
    }
  });
  return seen;
};

// "fleet_error.42501" -> { group: 'fleet_error', detail: '42501' }
export const splitCounter = (name) => {
  const [group, ...rest] = String(name).split('.');
  return { group, detail: rest.join('.') || null };
};

// The known counter groups, in the order the screen lists them; others follow by name.
export const COUNTER_GROUPS = [
  'js_error',
  'render_error',
  'chunk_load_error',
  'socket_disconnect',
  'socket_reconnect',
  'token_failure',
  'api_error',
  'fleet_error',
];

// One release: vitals in a fixed order, counters by group, and the long tasks.
export const releaseHealth = (rows, release) => {
  const mine = (rows || []).filter((row) => row.release === release);
  const vitals = VITAL_ORDER.map((name) => {
    const row = mine.find((item) => item.kind === 'vital' && item.name === name);
    return row
      ? {
          name,
          p75: row.p75,
          good: row.good,
          samples: Number(row.samples),
          rating: vitalRating(name, row.p75),
        }
      : { name, p75: null, good: null, samples: 0, rating: null };
  });
  const rank = (group) => {
    const index = COUNTER_GROUPS.indexOf(group);
    return index < 0 ? COUNTER_GROUPS.length : index;
  };
  const counters = mine
    .filter((row) => row.kind === 'counter')
    .map((row) => ({
      ...splitCounter(row.name),
      name: row.name,
      total: Number(row.total),
      orgs: Number(row.orgs),
      lastAt: row.last_at,
    }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name));
  const long = (name) => mine.find((row) => row.kind === 'longtask' && row.name === name);
  const longTasks = long('count')
    ? {
        count: Number(long('count').total),
        totalMs: Number(long('total_ms')?.total || 0),
        maxMs: Number(long('max_ms')?.maximum || 0),
      }
    : null;
  return { vitals, counters, longTasks };
};

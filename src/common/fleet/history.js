// Roadmap 4.3 "activity per entity": what changed in an audit_log row (pure, tested).

const IGNORED = new Set(['updated_at', 'created_at', 'id', 'org_id', 'metadata']);

// Keys whose value changed between old_data and new_data (for inserts: the keys that were set).
export const changedFields = (row) => {
  const before = row.old_data || {};
  const after = row.new_data || {};
  if (row.action === 'delete') {
    return [];
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !IGNORED.has(key))
    .filter((key) =>
      row.action === 'insert'
        ? after[key] !== null &&
          after[key] !== '' &&
          !(Array.isArray(after[key]) && !after[key].length)
        : JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .sort();
};

const show = (value) => {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Technical columns that mean nothing to a person reading the history: who did it is already
// in its own column, and links between rows are shown by name (driver_id, vehicle_id) or not
// at all.
const HIDDEN = new Set([
  'created_by',
  'updated_by',
  'uploaded_by',
  'reported_by',
  'traccar_device_id',
  'traccar_driver_id',
  'license_class',
  'external_id',
  'import_batch',
  'anomaly_flags',
]);
const NAMED_LINKS = new Set(['driver_id', 'vehicle_id']);

export const isHiddenField = (key) =>
  HIDDEN.has(key) || (/(_id|_by|_path)$/.test(key) && !NAMED_LINKS.has(key));

// "field: before → after" for an update, "field: value" for an insert. `label` and `format`
// turn database names and raw values into words; by default both are shown as stored.
export const describeChanges = (row, limit = 4, options = {}) => {
  const {
    label = (key) => key,
    format = (key, value) => show(value),
    hide = () => false,
  } = options;
  return changedFields(row)
    .filter((key) => !hide(key))
    .slice(0, limit)
    .map((key) =>
      row.action === 'update'
        ? `${label(key)}: ${format(key, row.old_data?.[key])} → ${format(key, row.new_data?.[key])}`
        : `${label(key)}: ${format(key, row.new_data?.[key])}`,
    );
};

// Ids of linked drivers / vehicles in these rows, to look their names up.
export const linkedIds = (rows, key) => [
  ...new Set(
    rows
      .flatMap((row) => [row.old_data?.[key], row.new_data?.[key]])
      .filter((value) => typeof value === 'string' && value),
  ),
];

export const showValue = show;

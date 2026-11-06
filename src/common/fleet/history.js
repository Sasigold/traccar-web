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

// "field: before → after" for an update, "field: value" for an insert.
export const describeChanges = (row, limit = 4) =>
  changedFields(row)
    .slice(0, limit)
    .map((key) =>
      row.action === 'update'
        ? `${key}: ${show(row.old_data?.[key])} → ${show(row.new_data?.[key])}`
        : `${key}: ${show(row.new_data?.[key])}`,
    );

// ARC-08: PostgREST answers at most one page (1,000 rows by default) per request, and a longer
// list used to stop there without a word. Pages are read with .range() until one comes back
// short, up to a ceiling; reaching the ceiling is reported, not hidden.
export const PAGE_SIZE = 1000;
export const MAX_ROWS = 20000;

export const fetchPaged = async (page, { pageSize = PAGE_SIZE, max = MAX_ROWS } = {}) => {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const batch = (await page(from, from + pageSize - 1)) || [];
    rows.push(...batch);
    if (batch.length < pageSize) return { rows, truncated: false };
  }
  return { rows, truncated: true };
};

// The same for one query of the fleet database: `build()` makes a fresh builder for each page.
// A cut-off is told once per table and session.
const told = new Set();
export const readAll = async (table, build, signal, notify) => {
  const result = await fetchPaged(async (from, to) => {
    let query = build().range(from, to);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  });
  if (result.truncated && !told.has(table)) {
    told.add(table);
    notify?.(table, result.rows.length);
  }
  return result.rows;
};

// An in-memory stand-in for the part of the Supabase client the app uses (FND-07): from(table)
// with select / insert / update / upsert / delete, the eq / in / is filters, order, single and
// maybeSingle. Enough to test code that orchestrates several tables; RLS itself is tested
// against Postgres in supabase/tests.
export const createFakeSupabase = (tables = {}) => {
  const data = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  );
  const log = [];

  const query = (table) => {
    const filters = [];
    let action = 'select';
    let payload = null;
    let conflict = null;
    let mode = 'many';
    let orderBy = null;

    const rowsOf = () => (data[table] ||= []);
    const matches = (row) => filters.every((filter) => filter(row));

    const run = () => {
      const rows = rowsOf();
      let result;
      if (action === 'insert') {
        const added = [payload].flat().map((row) => ({ ...row }));
        rows.push(...added);
        result = added;
      } else if (action === 'upsert') {
        const keys = (conflict || 'id').split(',');
        result = [payload].flat().map((row) => {
          const existing = rows.find((item) => keys.every((key) => item[key] === row[key]));
          if (existing) {
            Object.assign(existing, row);
            return existing;
          }
          const added = { ...row };
          rows.push(added);
          return added;
        });
      } else if (action === 'update') {
        result = rows.filter(matches);
        result.forEach((row) => Object.assign(row, payload));
      } else if (action === 'delete') {
        result = rows.filter(matches);
        data[table] = rows.filter((row) => !matches(row));
      } else {
        result = rows.filter(matches);
        if (orderBy) {
          const { column, ascending } = orderBy;
          result = [...result].sort(
            (a, b) =>
              (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1),
          );
        }
      }
      log.push({ table, action, payload, rows: result.length });
      result = result.map((row) => ({ ...row }));
      if (mode === 'single') {
        return result.length === 1
          ? { data: result[0], error: null, status: 200 }
          : { data: null, error: { code: 'PGRST116', message: 'not one row' }, status: 406 };
      }
      if (mode === 'maybeSingle') {
        return { data: result[0] ?? null, error: null, status: 200 };
      }
      return { data: result, error: null, status: 200 };
    };

    const set = (nextAction, nextPayload, options = {}) => {
      action = nextAction;
      payload = nextPayload;
      conflict = options.onConflict || null;
      return builder;
    };
    const filter = (test) => {
      filters.push(test);
      return builder;
    };
    const builder = {
      select: () => builder,
      insert: (rows) => set('insert', rows),
      update: (fields) => set('update', fields),
      upsert: (rows, options) => set('upsert', rows, options),
      delete: () => set('delete', null),
      eq: (column, value) => filter((row) => row[column] === value),
      neq: (column, value) => filter((row) => row[column] !== value),
      in: (column, values) => filter((row) => values.includes(row[column])),
      is: (column, value) => filter((row) => (row[column] ?? null) === value),
      order: (column, { ascending = true } = {}) => {
        orderBy ||= { column, ascending };
        return builder;
      },
      limit: () => builder,
      abortSignal: () => builder,
      single: () => {
        mode = 'single';
        return builder;
      },
      maybeSingle: () => {
        mode = 'maybeSingle';
        return builder;
      },
      // Awaiting the query runs it, as with the real client.
      then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject),
    };
    return builder;
  };

  return {
    client: { from: query, rpc: async () => ({ data: null, error: null, status: 200 }) },
    data,
    log,
  };
};

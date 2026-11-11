// ARC-10: what a list's rows show after the filter chip and the search box. Pure.
export const filterRows = (rows, { filters, filter, searchOf, search }) => {
  const keyword = search.trim().toLowerCase();
  const test = filters?.find((item) => item.key === filter)?.test;
  return (rows || []).filter(
    (row) =>
      (!test || test(row)) &&
      (!keyword ||
        searchOf(row).some(
          (value) => value != null && String(value).toLowerCase().includes(keyword),
        )),
  );
};

// ADM-15: rows in a column's order. Numbers by value, text in Hebrew order, empty values last
// whichever way. `valueOf(row)` is the column's sort value.
const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });
export const sortRows = (rows, valueOf, direction = 'asc') => {
  if (!valueOf) return rows;
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    const xEmpty = x == null || x === '';
    const yEmpty = y == null || y === '';
    if (xEmpty || yEmpty) return xEmpty === yEmpty ? 0 : xEmpty ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
    return collator.compare(String(x), String(y)) * sign;
  });
};

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

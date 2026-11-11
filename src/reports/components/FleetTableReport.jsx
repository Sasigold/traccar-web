import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Link, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '../../common/components/LocalizationProvider';
import PageLayout from '../../common/components/PageLayout';
import DataTable from '../../common/components/table/DataTable';
import TableShimmer from '../../common/components/TableShimmer';
import { useCatch, useCatchCallback } from '../../reactHelper';
import exportExcel from '../../common/util/exportExcel';
import ReportsMenu from './ReportsMenu';
import ReportFilter from './ReportFilter';
import { ReportEmptyRow, ReportTotalsRow, SortCell, useReportSort } from './ReportTableParts';
import useReportStyles from '../common/useReportStyles';
import usePersistedState from '../../common/util/usePersistedState';
import { delta, formatDelta, previousRange } from '../common/compare';
import CompareSwitch from './CompareSwitch';

// The vehicles a report covers: the chosen ones and those in the chosen groups.
export const devicesInScope = (devices, deviceIds, groupIds) =>
  Object.values(devices).filter(
    (device) => deviceIds.includes(device.id) || groupIds.includes(device.groupId),
  );

// A per-vehicle table report (REP-23): the filter, sortable columns, a totals row and the Excel
// export, around `load({ devices, deviceIds, groupIds, from, to })` → rows with deviceId and name.
// columns: [{ key, labelKey, format(value, row) , exportValue? }]; totals: { key: 'sum' | ... }.
const FleetTableReport = ({
  reportKey,
  titleKey,
  columns,
  totals = {},
  load,
  filterChildren,
  // Rows are vehicles unless a report says otherwise (OPS-05: drivers).
  rowKey = (item) => item.deviceId,
  rowLink = (item) => `/fleet/vehicle/${item.deviceId}`,
  nameLabelKey = 'sharedDevice',
  // A note above the table drawn from the results (OPS-04: the fleet-size recommendation).
  summary,
  // REP-09: the columns that show the change from the period before, when it is asked for.
  compared = [],
}) => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();
  const devices = useSelector((state) => state.devices.items);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [compare, setCompare] = usePersistedState(`${reportKey}Compare`, false);
  const [previous, setPrevious] = useState(null);
  // Reports pass rowKey inline; a ref keeps onShow from changing on every render.
  const rowKeyRef = useRef(rowKey);
  rowKeyRef.current = rowKey;
  const { sorted, sort, toggle } = useReportSort(reportKey, items, (item, key) =>
    key === 'name' ? item.name : item[key],
  );

  const onShow = useCatchCallback(
    async ({ deviceIds, groupIds, from, to }) => {
      setLoading(true);
      try {
        const scope = {
          devices: devicesInScope(devices, deviceIds, groupIds),
          deviceIds,
          groupIds,
        };
        const withPrevious = compare && compared.length > 0;
        const [rows, earlier] = await Promise.all([
          load({ ...scope, from, to }),
          withPrevious ? load({ ...scope, ...previousRange(from, to) }) : null,
        ]);
        setItems(rows);
        setPrevious(earlier ? new Map(earlier.map((row) => [rowKeyRef.current(row), row])) : null);
      } finally {
        setLoading(false);
        setQueried(true);
      }
    },
    [devices, load, compare, compared.length],
  );

  const onExport = useCatch(async () => {
    const rows = sorted.map((item) => ({
      [t(nameLabelKey)]: item.name,
      ...Object.fromEntries(
        columns.map((column) => [
          t(column.labelKey),
          column.exportValue ? column.exportValue(item[column.key], item) : item[column.key],
        ]),
      ),
    }));
    const title = t(titleKey);
    await exportExcel(title, `${reportKey}.xlsx`, new Map([[title, rows]]), theme, {
      totals: columns.filter((column) => totals[column.key] === 'sum').map((c) => t(c.labelKey)),
    });
  });

  const keys = columns.map((column) => column.key);
  // BRD-04: number columns are aligned to the end (MUI's "right" turns to the left in RTL).
  const numeric = new Set(
    keys.filter((key) => items.some((item) => typeof item[key] === 'number')),
  );
  const align = (key) => (numeric.has(key) ? 'right' : undefined);
  const format = (item, key) => {
    const column = columns.find((it) => it.key === key);
    return column.format ? column.format(item[key], item) : item[key];
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', titleKey]}>
      <div className={classes.container}>
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter
              onShow={onShow}
              onExport={onExport}
              deviceType="multiple"
              loading={loading}
              formats={['xlsx']}
            >
              {filterChildren}
              {compared.length > 0 && <CompareSwitch checked={compare} onChange={setCompare} />}
            </ReportFilter>
          </div>
          {!loading && summary?.(items)}
          <DataTable variant="flush">
            <TableHead>
              <TableRow>
                <SortCell sortKey="name" sort={sort} onSort={toggle}>
                  {t(nameLabelKey)}
                </SortCell>
                {columns.map((column) => (
                  <SortCell
                    key={column.key}
                    sortKey={column.key}
                    sort={sort}
                    onSort={toggle}
                    align={align(column.key)}
                  >
                    {t(column.labelKey)}
                  </SortCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && queried && !items.length && <ReportEmptyRow colSpan={keys.length + 1} />}
              {!loading ? (
                sorted.map((item) => (
                  <TableRow key={rowKey(item)} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {rowLink(item) ? (
                        <Link component={RouterLink} to={rowLink(item)}>
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </TableCell>
                    {keys.map((key) => {
                      const change =
                        previous && compared.includes(key)
                          ? delta(item[key], previous.get(rowKey(item))?.[key])
                          : null;
                      return (
                        <TableCell key={key} align={align(key)}>
                          {format(item, key)}
                          {change && (
                            <span
                              className={classes.delta}
                              aria-label={t('reportChangeFromPrevious').replace(
                                '{0}',
                                formatDelta(change),
                              )}
                            >
                              <bdi dir="ltr">{formatDelta(change)}</bdi>
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={keys.length + 1} />
              )}
            </TableBody>
            {!loading && (
              <ReportTotalsRow
                leading={1}
                columns={keys}
                spec={totals}
                items={sorted}
                format={format}
                numeric={numeric}
              />
            )}
          </DataTable>
        </div>
      </div>
    </PageLayout>
  );
};

export default FleetTableReport;

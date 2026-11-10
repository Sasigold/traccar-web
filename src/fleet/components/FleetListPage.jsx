import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import PageLayout from '../../common/components/PageLayout';
import DataTable from '../../common/components/table/DataTable';
import TableToolbar from '../../common/components/table/TableToolbar';
import TableShimmer from '../../common/components/TableShimmer';
import SettingsMenu from '../../settings/components/SettingsMenu';
import exportExcel from '../../common/util/exportExcel';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { useFleetQuery } from '../../common/data/fleetQuery';
import FleetNotice from './FleetNotice';
import { filterRows } from './listRows';

const useStyles = makeStyles()(() => ({
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

// ARC-10: the frame every fleet list shared, written once. The page says what to read
// (`table`, `query`, read through the cache in pages, ARC-06 and ARC-08), how to filter and
// search it, and what each column shows; this does the permission notice, the toolbar (search,
// filter chips, count, Excel), the loading rows, the empty state and the clickable rows.
//
//   columns: [{ key, label, render?(row), value?(row) (Excel, and the cell when no render),
//               nowrap?, ltr?, table? (false: only in Excel), export? (false: only on screen) }]
//   filters: [{ key, label, test?(row) }] (the first is the default unless `defaultFilter`)
const FleetListPage = ({
  title,
  description,
  permission,
  table,
  queryParts = [],
  query,
  filters,
  defaultFilter,
  searchOf = () => [],
  columns,
  rowLink,
  actions,
  emptyState,
  exportFile,
  children,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const canRead = useFleetPermission(permission);

  const [filter, setFilter] = useState(defaultFilter ?? filters?.[0]?.key);
  const [search, setSearch] = useState('');
  const { data: rows } = useFleetQuery(table, queryParts, query, {
    enabled: canRead,
    paged: true,
  });

  // filters and searchOf are written inline by the pages: the latest ones are used, and the
  // rows and the inputs decide when to filter again.
  const rulesRef = useRef({ filters, searchOf });
  rulesRef.current = { filters, searchOf };
  const filtered = useMemo(
    () => filterRows(rows, { ...rulesRef.current, filter, search }),
    [rows, filter, search],
  );

  const cellValue = (column, row) => (column.value ? column.value(row) : row[column.key]);

  const handleExport = async () => {
    const data = filtered.map((row) =>
      Object.fromEntries(
        columns
          .filter((column) => column.export !== false)
          .map((column) => [column.label, cellValue(column, row) ?? '']),
      ),
    );
    const sheets = new Map();
    sheets.set(t(title), data);
    await exportExcel(t(title), exportFile, sheets, theme);
  };

  const open = (row) => rowLink && navigate(rowLink(row));
  const shown = columns.filter((column) => column.table !== false);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', title]}
      description={description && t(description)}
    >
      <FleetNotice permission={permission} />
      {children}
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows ? filtered.length : undefined}
            exportHandler={exportFile ? handleExport : undefined}
            filters={filters?.map((item) => (
              <Chip
                key={item.key}
                size="small"
                label={item.label}
                color={filter === item.key ? 'primary' : 'default'}
                variant={filter === item.key ? 'filled' : 'outlined'}
                onClick={() => setFilter(item.key)}
              />
            ))}
            actions={actions}
          />
        }
        empty={rows != null && filtered.length === 0}
        emptyState={
          emptyState && {
            ...emptyState,
            title: search ? t('tableNoMatches') : emptyState.title,
            description: search ? undefined : emptyState.description,
          }
        }
      >
        <TableHead>
          <TableRow>
            {shown.map((column) => (
              <TableCell key={column.key}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && canRead && <TableShimmer columns={shown.length} />}
          {filtered.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={rowLink ? 0 : undefined}
              className={rowLink ? classes.row : undefined}
              onClick={() => open(row)}
              onKeyDown={(event) => event.key === 'Enter' && open(row)}
            >
              {shown.map((column) => {
                const content = column.render ? column.render(row) : cellValue(column, row);
                return (
                  <TableCell
                    key={column.key}
                    className={column.nowrap ? classes.nowrap : undefined}
                  >
                    {column.ltr ? <span dir="ltr">{content}</span> : content}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default FleetListPage;

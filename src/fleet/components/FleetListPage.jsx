import { useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Chip,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  useMediaQuery,
} from '@mui/material';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BaseFab from '../../common/components/BaseFab';
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
import { filterRows, sortRows } from './listRows';

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
//               nowrap?, ltr?, table? (false: only in Excel), export? (false: only on screen),
//               sortValue?(row) (default: the row's own `key`, else value), sort? (false) }]
// ADM-15: the chip, the search and the order live in the address (?filter=, ?q=, ?sort=,
// ?dir=), so a link or the back button lands on the same list.
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
  onRowClick,
  actions,
  // ADM-29: the page's "add": a button in the toolbar on desktop, a floating button on phones.
  // { label, to } or { label, onClick }.
  add,
  emptyState,
  exportFile,
  children,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const canRead = useFleetPermission(permission);
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [params, setParams] = useSearchParams();
  const setParam = (changes) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) =>
          value ? next.set(key, value) : next.delete(key),
        );
        return next;
      },
      { replace: true },
    );
  const initialFilter = defaultFilter ?? filters?.[0]?.key;
  const filter = filters?.some((item) => item.key === params.get('filter'))
    ? params.get('filter')
    : initialFilter;
  const setFilter = (key) => setParam({ filter: key === initialFilter ? null : key });
  // The box answers at once; the address follows.
  const [search, setSearch] = useState(() => params.get('q') || '');
  const changeSearch = (value) => {
    setSearch(value);
    setParam({ q: value.trim() || null });
  };
  const sortKey = params.get('sort');
  const sortDir = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const { data: rows } = useFleetQuery(table, queryParts, query, {
    enabled: canRead,
    paged: true,
  });

  // filters and searchOf are written inline by the pages: the latest ones are used, and the
  // rows and the inputs decide when to filter again.
  const rulesRef = useRef({ filters, searchOf });
  rulesRef.current = { filters, searchOf };
  const cellValue = (column, row) => (column.value ? column.value(row) : row[column.key]);
  const sortColumn = columns.find((column) => column.key === sortKey && column.sort !== false);
  const sortValueOf = (column) =>
    column &&
    (column.sortValue || ((row) => (column.key in row ? row[column.key] : cellValue(column, row))));
  const filtered = useMemo(
    () =>
      sortRows(
        filterRows(rows, { ...rulesRef.current, filter, search }),
        sortValueOf(sortColumn),
        sortDir,
      ),
    // The column is found by its key, which is the dependency.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [rows, filter, search, sortKey, sortDir],
  );
  const sortBy = (key) =>
    setParam(
      sortKey === key
        ? { sort: sortDir === 'asc' ? key : null, dir: sortDir === 'asc' ? 'desc' : null }
        : { sort: key, dir: null },
    );

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

  // On a phone the rows are cards without the header: the order is chosen from a list.
  const shown = columns.filter((column) => column.table !== false);
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const sortable = shown.filter((column) => column.sort !== false && column.label);
  const phoneSort = phone && (
    <>
      <TextField
        select
        size="small"
        label={t('sharedSortBy')}
        value={sortColumn ? sortKey : ''}
        onChange={(event) => setParam({ sort: event.target.value || null, dir: null })}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="">{t('sharedSortDefault')}</MenuItem>
        {sortable.map((column) => (
          <MenuItem key={column.key} value={column.key}>
            {column.label}
          </MenuItem>
        ))}
      </TextField>
      {sortColumn && (
        <IconButton
          size="small"
          aria-label={t(sortDir === 'asc' ? 'sharedSortDescending' : 'sharedSortAscending')}
          onClick={() => setParam({ dir: sortDir === 'asc' ? 'desc' : null })}
        >
          <SwapVertRoundedIcon fontSize="small" />
        </IconButton>
      )}
    </>
  );

  const open = (row) => (onRowClick ? onRowClick(row) : rowLink && navigate(rowLink(row)));
  const clickable = Boolean(onRowClick || rowLink);

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
            search={{ value: search, onChange: changeSearch }}
            count={rows ? filtered.length : undefined}
            exportHandler={exportFile ? handleExport : undefined}
            filters={[
              ...(filters || []).map((item) => (
                <Chip
                  key={item.key}
                  size="small"
                  label={item.label}
                  color={filter === item.key ? 'primary' : 'default'}
                  variant={filter === item.key ? 'filled' : 'outlined'}
                  onClick={() => setFilter(item.key)}
                />
              )),
              phoneSort && <span key="sort">{phoneSort}</span>,
            ].filter(Boolean)}
            actions={
              (actions || (add && desktop)) && (
                <>
                  {actions}
                  {add && desktop && (
                    <Button
                      variant="contained"
                      size="small"
                      {...(add.to
                        ? { component: RouterLink, to: add.to }
                        : { onClick: add.onClick })}
                    >
                      {add.label}
                    </Button>
                  )}
                </>
              )
            }
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
              <TableCell key={column.key} sortDirection={sortKey === column.key ? sortDir : false}>
                {column.sort === false ? (
                  column.label
                ) : (
                  <TableSortLabel
                    active={sortKey === column.key}
                    direction={sortKey === column.key ? sortDir : 'asc'}
                    onClick={() => sortBy(column.key)}
                  >
                    {column.label}
                  </TableSortLabel>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && canRead && <TableShimmer columns={shown.length} />}
          {filtered.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={clickable ? 0 : undefined}
              className={clickable ? classes.row : undefined}
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
      {add && !desktop && (
        <BaseFab label={add.label} to={add.to} onClick={add.to ? undefined : add.onClick}>
          <AddRoundedIcon />
        </BaseFab>
      )}
    </PageLayout>
  );
};

export default FleetListPage;

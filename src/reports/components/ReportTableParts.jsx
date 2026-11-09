import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Button, TableCell, TableFooter, TableRow, TableSortLabel } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import usePersistedState from '../../common/util/usePersistedState';
import EmptyState from '../../common/components/table/EmptyState';
import { getFormatLocale } from '../../common/util/formatter';

const useStyles = makeStyles()((theme) => ({
  // The totals row stays at the bottom of the scrolling table, on an ice band.
  totals: {
    '& td': {
      position: 'sticky',
      bottom: 0,
      zIndex: 1,
      backgroundColor: theme.palette.surface.tint,
      color: theme.palette.text.primary,
      fontWeight: 700,
      borderTop: `1px solid ${theme.palette.surface.borderStrong}`,
      whiteSpace: 'nowrap',
    },
  },
  note: {
    padding: theme.spacing(1, 2),
    color: theme.palette.text.secondary,
    fontSize: '0.8125rem',
  },
}));

const compare = (a, b) => {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) {
    return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b), getFormatLocale(), { numeric: true });
};

// Sorting by column, remembered per report. Click: ascending, again: descending, again: off.
// Rows with no value always go last.
export const useReportSort = (reportKey, items, valueOf = (item, key) => item[key]) => {
  const [sort, setSort] = usePersistedState(`reportSort.${reportKey}`, null);
  const sorted = useMemo(() => {
    if (!sort) {
      return items;
    }
    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const x = valueOf(a, sort.key);
      const y = valueOf(b, sort.key);
      const emptyX = x === null || x === undefined || x === '';
      const emptyY = y === null || y === undefined || y === '';
      if (emptyX || emptyY) {
        return compare(x, y);
      }
      return compare(x, y) * direction;
    });
    // valueOf is defined inline by the pages
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [items, sort]);
  const toggle = (key) =>
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      return current.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  return { sorted, sort, toggle };
};

// A header cell that sorts its column (aria-sort comes from sortDirection).
export const SortCell = ({ sortKey, sort, onSort, children, className }) => {
  const active = sort?.key === sortKey;
  return (
    <TableCell className={className} sortDirection={active ? sort.direction : false}>
      <TableSortLabel
        active={active}
        direction={active ? sort.direction : 'asc'}
        onClick={() => onSort(sortKey)}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );
};

// Totals of the shown rows: 'sum', 'max', or 'avg:<weight key>' (an average weighted by another
// column, such as average speed by duration).
export const totalsOf = (items, spec) => {
  const result = {};
  Object.entries(spec).forEach(([key, rule]) => {
    const values = items.map((item) => item[key]).filter((value) => typeof value === 'number');
    if (!values.length) {
      result[key] = null;
    } else if (rule === 'sum') {
      result[key] = values.reduce((a, b) => a + b, 0);
    } else if (rule === 'max') {
      result[key] = Math.max(...values);
    } else if (rule.startsWith('avg:')) {
      const weightKey = rule.slice(4);
      let weight = 0;
      let total = 0;
      items.forEach((item) => {
        if (typeof item[key] === 'number' && typeof item[weightKey] === 'number') {
          total += item[key] * item[weightKey];
          weight += item[weightKey];
        }
      });
      result[key] = weight > 0 ? total / weight : null;
    }
  });
  return result;
};

// The totals row. `leading` cells come before the columns (actions, vehicle).
export const ReportTotalsRow = ({ leading = 1, columns, spec, items, format }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const totals = useMemo(() => totalsOf(items, spec), [items, spec]);
  if (!items.length || !columns.some((key) => key in spec)) {
    return null;
  }
  return (
    <TableFooter>
      <TableRow className={classes.totals}>
        <TableCell colSpan={leading}>{t('exportTotal')}</TableCell>
        {columns.map((key) => (
          <TableCell key={key}>
            {key in spec && totals[key] != null ? format({ ...totals }, key) : null}
          </TableCell>
        ))}
      </TableRow>
    </TableFooter>
  );
};

// Nothing found for the chosen period and vehicles (not "still loading"): say so, and offer the
// last 30 days in one click.
export const ReportEmptyRow = ({ colSpan }) => {
  const t = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const extend = () => {
    const params = new URLSearchParams(searchParams);
    params.set('period', 'custom');
    params.set('from', dayjs().subtract(30, 'day').startOf('day').toISOString());
    params.set('to', dayjs().toISOString());
    setSearchParams(params, { replace: true });
  };
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <EmptyState
          icon={<EventBusyRoundedIcon />}
          title={t('reportEmptyTitle')}
          description={t('reportEmptyText')}
          action={
            <Button variant="outlined" onClick={extend}>
              {t('reportEmptyExtend')}
            </Button>
          }
        />
      </TableCell>
    </TableRow>
  );
};

// When a report shows only part of the rows, it says so.
export const ReportLimitNote = ({ shown, total }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  if (total <= shown) {
    return null;
  }
  const number = (value) => value.toLocaleString(getFormatLocale());
  return (
    <div className={classes.note} role="status">
      {t('reportLimitNote').replace('{0}', number(shown)).replace('{1}', number(total))}
    </div>
  );
};

import { Paper, TableContainer } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EmptyState from './EmptyState';
import ResponsiveTable from './ResponsiveTable';

const useStyles = makeStyles()((theme) => ({
  refreshing: {
    opacity: 0.55,
    transition: `opacity ${theme.tokens.motion.duration.fast}ms`,
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  card: {
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    margin: theme.spacing(0.5, 3, 3),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      borderRadius: 0,
      borderInline: 'none',
    },
    '@media print': {
      margin: 0,
      border: 'none',
    },
  },
  container: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    '@media print': {
      overflow: 'visible',
    },
  },
  table: {
    '& .MuiTableCell-root': {
      paddingBlock: theme.spacing(1.25),
      paddingInline: theme.spacing(2),
    },
    '& .MuiTableCell-head': {
      paddingBlock: theme.spacing(1.25),
    },
  },
  flush: {
    '& .MuiTableCell-root:first-of-type': {
      paddingInlineStart: theme.spacing(3),
    },
    '& .MuiTableCell-root:last-of-type': {
      paddingInlineEnd: theme.spacing(3),
    },
  },
}));

// Table wrapper: a card with an optional toolbar, a scrolling container with a
// sticky header, and an empty state. Children are the page's own TableHead/TableBody.
// On phones and tablets the rows are shown as cards (see ResponsiveTable).
const DataTable = ({
  toolbar,
  children,
  empty = false,
  emptyState,
  variant = 'card',
  stickyHeader = true,
  minWidth,
  responsive = true,
  className,
  // ADM-28: rows being reloaded stay on screen, dimmed.
  refreshing = false,
}) => {
  const { classes, cx } = useStyles();
  const card = variant === 'card';
  const Root = card ? Paper : 'div';
  return (
    <Root
      className={cx(classes.root, card && classes.card, className)}
      {...(card && { elevation: 0 })}
    >
      {toolbar}
      <TableContainer className={classes.container}>
        <ResponsiveTable
          responsive={responsive}
          stickyHeader={stickyHeader}
          size="small"
          className={cx(classes.table, !card && classes.flush, refreshing && classes.refreshing)}
          aria-busy={refreshing || undefined}
          style={minWidth ? { minWidth } : undefined}
        >
          {children}
        </ResponsiveTable>
      </TableContainer>
      {empty && <EmptyState compact {...emptyState} />}
    </Root>
  );
};

export default DataTable;

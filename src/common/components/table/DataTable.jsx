import { Paper, Table, TableContainer } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EmptyState from './EmptyState';

const useStyles = makeStyles()((theme) => ({
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
    '& .MuiTableCell-body': {
      maxWidth: 320,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
const DataTable = ({
  toolbar,
  children,
  empty = false,
  emptyState,
  emptyContent,
  variant = 'card',
  stickyHeader = true,
  minWidth,
  className,
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
      <TableContainer className={classes.container} style={empty ? { flex: 'none' } : undefined}>
        <Table
          stickyHeader={stickyHeader}
          size="small"
          className={cx(classes.table, !card && classes.flush)}
          style={minWidth ? { minWidth } : undefined}
        >
          {children}
        </Table>
      </TableContainer>
      {empty && (emptyContent || <EmptyState compact {...emptyState} />)}
    </Root>
  );
};

export default DataTable;

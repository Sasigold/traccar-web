import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    width: '100%',
    height: '100%',
    overflow: 'auto',
  },
  head: {
    '& th': {
      paddingInline: theme.spacing(1),
      ...theme.typography.caption,
      fontWeight: 600,
      color: theme.palette.surface.textSecondaryOnTint,
      backgroundColor: theme.palette.surface.tint,
      borderBottom: 'none',
      whiteSpace: 'nowrap',
    },
  },
  row: {
    '& td': {
      ...theme.typography.body2,
      paddingInline: theme.spacing(1),
      borderBottom: `1px solid ${theme.palette.divider}`,
      paddingBlock: theme.spacing(0.75),
    },
    '&:last-of-type td': {
      borderBottom: 'none',
    },
  },
  clickable: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  swatch: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: 2,
    marginInlineEnd: theme.spacing(1),
    verticalAlign: 'middle',
  },
}));

// The accessible twin of every chart: the same numbers as rows.
// columns: [{ key, label, numeric }], rows: [{ key, cells: { [key]: text }, color?, raw? }]
const TableView = ({ columns, rows, onSelect, caption }) => {
  const { classes, cx } = useStyles();
  return (
    <div className={classes.root}>
      <Table size="small" stickyHeader aria-label={caption}>
        <TableHead className={classes.head}>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} align={column.numeric ? 'right' : 'left'}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              className={cx(classes.row, onSelect && classes.clickable)}
              onClick={onSelect ? () => onSelect(row.raw) : undefined}
            >
              {columns.map((column, index) => (
                <TableCell
                  key={column.key}
                  align={column.numeric ? 'right' : 'left'}
                  className={column.numeric ? classes.number : undefined}
                >
                  {index === 0 && row.color && (
                    <span className={classes.swatch} style={{ backgroundColor: row.color }} />
                  )}
                  {column.numeric ? (
                    <span dir="ltr">{row.cells[column.key]}</span>
                  ) : (
                    row.cells[column.key]
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableView;

import { Skeleton, TableCell, TableRow } from '@mui/material';

const widths = ['70%', '45%', '60%', '35%', '55%'];

const TableShimmer = ({ columns, startAction, endAction, ref, rows = 5 }) =>
  [...Array(rows)].map((_, i) => (
    <TableRow key={-i} ref={i === 0 ? ref : null}>
      {[...Array(columns)].map((_, j) => {
        const action = (startAction && j === 0) || (endAction && j === columns - 1);
        return (
          <TableCell key={-j} padding={action ? 'none' : 'normal'}>
            {!action && <Skeleton width={widths[(i + j) % widths.length]} />}
          </TableCell>
        );
      })}
    </TableRow>
  ));

export default TableShimmer;

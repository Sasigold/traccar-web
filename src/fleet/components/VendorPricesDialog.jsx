import { useReducer, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  add: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto',
    gap: theme.spacing(1),
    alignItems: 'start',
    marginTop: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    },
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
}));

const KINDS = ['labor', 'part', 'fee'];
const emptyLine = { description: '', kind: 'part', unit_price: '', tolerance_pct: '5' };

// ISR-13: a supplier's agreed prices, which the work order's invoice check compares against.
const VendorPricesDialog = ({ vendor, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canWrite = useFleetPermission('maintenance.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [rows, setRows] = useState(null);
  const [line, setLine] = useState(emptyLine);

  useAsyncTask(async () => {
    void reloadKey;
    setRows(
      unwrap(
        await getFleetClient()
          .from('vendor_prices')
          .select('*')
          .eq('vendor_id', vendor.id)
          .order('description'),
      ) || [],
    );
  }, [vendor.id, reloadKey]);

  const add = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('vendor_prices')
        .insert({
          org_id: profile.org_id,
          vendor_id: vendor.id,
          description: line.description.trim(),
          kind: line.kind,
          unit_price: Number(line.unit_price),
          tolerance_pct: Number(line.tolerance_pct) || 0,
        }),
    );
    setLine(emptyLine);
    reload();
  });

  const remove = useCatch(async (id) => {
    unwrap(await getFleetClient().from('vendor_prices').delete().eq('id', id));
    reload();
  });

  const valid =
    line.description.trim().length >= 2 && Number(line.unit_price) >= 0 && line.unit_price !== '';

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('vendorPricesTitle').replace('{0}', vendor.name)}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {t('vendorPricesHelp')}
        </Typography>
        {rows?.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetItemDescription')}</TableCell>
                <TableCell>{t('sharedType')}</TableCell>
                <TableCell>{t('vendorPricesAgreed')}</TableCell>
                <TableCell>{t('vendorPricesTolerance')}</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>
                    {row.kind
                      ? t(`fleetItemKind${row.kind[0].toUpperCase()}${row.kind.slice(1)}`)
                      : ''}
                  </TableCell>
                  <TableCell className={classes.number}>{money(row.unit_price)}</TableCell>
                  <TableCell className={classes.number}>{`${row.tolerance_pct}%`}</TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`${t('sharedRemove')} ${row.description}`}
                        onClick={() => remove(row.id)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          rows && (
            <Typography variant="body2" color="textSecondary">
              {t('vendorPricesNone')}
            </Typography>
          )
        )}
        {canWrite && (
          <div className={classes.add}>
            <TextField
              size="small"
              label={t('fleetItemDescription')}
              value={line.description}
              onChange={(event) => setLine({ ...line, description: event.target.value })}
            />
            <TextField
              select
              size="small"
              label={t('sharedType')}
              value={line.kind}
              onChange={(event) => setLine({ ...line, kind: event.target.value })}
            >
              {KINDS.map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {t(`fleetItemKind${kind[0].toUpperCase()}${kind.slice(1)}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label={t('vendorPricesAgreed')}
              value={line.unit_price}
              onChange={(event) => setLine({ ...line, unit_price: event.target.value })}
              slotProps={{ htmlInput: { min: 0, inputMode: 'decimal' } }}
            />
            <TextField
              size="small"
              type="number"
              label={t('vendorPricesTolerance')}
              value={line.tolerance_pct}
              onChange={(event) => setLine({ ...line, tolerance_pct: event.target.value })}
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
            />
            <Button variant="outlined" onClick={add} disabled={!valid}>
              {t('sharedAdd')}
            </Button>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedHide')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorPricesDialog;

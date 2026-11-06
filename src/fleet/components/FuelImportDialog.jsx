import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import {
  FUEL_FIELDS,
  REQUIRED_FUEL_FIELDS,
  buildTransactions,
  guessColumns,
  parseCsv,
} from '../../common/fleet/fuelImport';
import { formatTime } from '../../common/util/formatter';
import { ensureVehicle, money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  mapping: {
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  preview: {
    maxHeight: 320,
    overflow: 'auto',
  },
  flags: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
}));

const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
export const fuelFlagKey = (flag) => `fleetFuelFlag${camel(flag)}`;

// Reads the first worksheet of an .xlsx file into rows of cell values.
const readWorkbook = async (file) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row) => {
    rows.push(
      row.values
        .slice(1)
        .map((value) =>
          value && typeof value === 'object' && 'result' in value ? value.result : value,
        ),
    );
  });
  return rows;
};

// Fuel company file -> fuel_transactions, with column mapping, preview and anomaly flags.
// Transactions already imported (same provider and transaction number) are skipped.
const FuelImportDialog = ({ onClose, onImported }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);

  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('');
  const [rows, setRows] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const vehicles = useMemo(
    () =>
      Object.values(devices)
        .filter((device) => device.attributes?.plateNumber)
        .map((device) => ({
          id: device.id,
          plate: device.attributes.plateNumber,
          fuelCapacity: device.attributes.fuelCapacity,
          fuelType: device.attributes.fuelType,
        })),
    [devices],
  );

  const load = useCatch(async (selected) => {
    setFile(selected);
    setResult(null);
    if (!selected) {
      setRows(null);
      return;
    }
    const all = /\.xlsx$/i.test(selected.name)
      ? await readWorkbook(selected)
      : parseCsv(await selected.text());
    setRows(all);
    setMapping(guessColumns(all[0] || []));
  });

  const headers = rows?.[0] || [];
  const transactions = useMemo(
    () => (rows ? buildTransactions(rows.slice(1), mapping, vehicles) : []),
    [rows, mapping, vehicles],
  );
  const valid = transactions.filter((tx) => !tx.errors.length);
  const mappedRequired = REQUIRED_FUEL_FIELDS.every((field) => mapping[field] !== undefined);

  const runImport = useCatch(async () => {
    setImporting(true);
    try {
      const client = getFleetClient();
      const source = provider.trim() || null;
      // Skip transactions this provider already sent.
      const ids = valid.map((tx) => tx.external_id).filter(Boolean);
      let known = new Set();
      if (ids.length) {
        let query = client.from('fuel_transactions').select('external_id').in('external_id', ids);
        query = source ? query.eq('provider', source) : query.is('provider', null);
        known = new Set((unwrap(await query) || []).map((row) => row.external_id));
      }
      const fresh = valid.filter((tx) => !tx.external_id || !known.has(tx.external_id));
      const vehicleIds = {};
      for (const tx of fresh) {
        if (tx.vehicle && !vehicleIds[tx.vehicle.id]) {
          vehicleIds[tx.vehicle.id] = await ensureVehicle(devices[tx.vehicle.id], profile);
        }
      }
      const batch = crypto.randomUUID();
      const payload = fresh.map((tx) => ({
        org_id: profile.org_id,
        vehicle_id: tx.vehicle ? vehicleIds[tx.vehicle.id] : null,
        occurred_at: tx.occurred_at,
        station: tx.station,
        fuel_type: tx.fuel_type,
        liters: tx.liters,
        unit_price: tx.unit_price,
        total: tx.total,
        odometer_reported: tx.odometer_reported,
        plate_number: tx.plate_number,
        external_id: tx.external_id,
        provider: source,
        source: 'import',
        anomaly_flags: tx.flags,
        import_batch: batch,
        created_by: profile.id,
      }));
      for (let i = 0; i < payload.length; i += 500) {
        unwrap(await client.from('fuel_transactions').insert(payload.slice(i, i + 500)));
      }
      setResult({
        imported: payload.length,
        duplicates: valid.length - fresh.length,
        invalid: transactions.length - valid.length,
      });
      onImported();
    } finally {
      setImporting(false);
    }
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('fleetFuelImport')}</DialogTitle>
      <DialogContent>
        <div className={classes.body}>
          <Typography variant="body2" color="textSecondary">
            {t('fleetFuelImportHint')}
          </Typography>
          <div className={classes.mapping}>
            <TextField
              label={t('fleetFuelProvider')}
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            />
            <FileInput
              placeholder={t('fleetFuelFile')}
              value={file}
              onChange={load}
              slotProps={{ htmlInput: { accept: '.csv,.xlsx,text/csv' } }}
            />
          </div>
          {rows && (
            <>
              <Typography variant="subtitle2">{t('fleetFuelColumns')}</Typography>
              <div className={classes.mapping}>
                {FUEL_FIELDS.map((field) => (
                  <TextField
                    key={field}
                    select
                    size="small"
                    label={t(`fleetFuelField${camel(field)}`)}
                    value={mapping[field] ?? ''}
                    required={REQUIRED_FUEL_FIELDS.includes(field)}
                    onChange={(event) => {
                      const next = { ...mapping };
                      if (event.target.value === '') {
                        delete next[field];
                      } else {
                        next[field] = Number(event.target.value);
                      }
                      setMapping(next);
                    }}
                  >
                    <MenuItem value="">&nbsp;</MenuItem>
                    {headers.map((header, index) => (
                      <MenuItem key={index} value={index}>
                        {String(header ?? '') || `#${index + 1}`}
                      </MenuItem>
                    ))}
                  </TextField>
                ))}
              </div>
              <Alert severity={valid.length ? 'info' : 'warning'}>
                {t('fleetFuelPreviewSummary')
                  .replace('{0}', String(valid.length))
                  .replace('{1}', String(transactions.length - valid.length))
                  .replace('{2}', String(valid.filter((tx) => tx.flags.length).length))}
              </Alert>
              <div className={classes.preview}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('fleetFuelFieldOccurredAt')}</TableCell>
                      <TableCell>{t('fleetFuelFieldPlateNumber')}</TableCell>
                      <TableCell>{t('fleetFuelFieldLiters')}</TableCell>
                      <TableCell>{t('fleetFuelFieldTotal')}</TableCell>
                      <TableCell>{t('fleetFuelAnomalies')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.slice(0, 50).map((tx) => (
                      <TableRow key={tx.line}>
                        <TableCell>
                          {tx.occurred_at ? formatTime(tx.occurred_at, 'minutes') : '—'}
                        </TableCell>
                        <TableCell>
                          <span dir="ltr">{tx.plate_number}</span>
                        </TableCell>
                        <TableCell>{tx.liters}</TableCell>
                        <TableCell>{money(tx.total)}</TableCell>
                        <TableCell>
                          <span className={classes.flags}>
                            {tx.errors.length > 0 && (
                              <Chip size="small" color="error" label={t('fleetFuelRowInvalid')} />
                            )}
                            {tx.flags.map((flag) => (
                              <Chip
                                key={flag}
                                size="small"
                                color="warning"
                                variant="outlined"
                                label={t(fuelFlagKey(flag))}
                              />
                            ))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          {result && (
            <Alert severity="success">
              {t('fleetFuelImported')
                .replace('{0}', String(result.imported))
                .replace('{1}', String(result.duplicates))
                .replace('{2}', String(result.invalid))}
            </Alert>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t(result ? 'adminClose' : 'sharedCancel')}</Button>
        {!result && (
          <Button
            variant="contained"
            onClick={runImport}
            disabled={!rows || !mappedRequired || !valid.length || importing}
          >
            {t('fleetFuelImportAction').replace('{0}', String(valid.length))}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default FuelImportDialog;

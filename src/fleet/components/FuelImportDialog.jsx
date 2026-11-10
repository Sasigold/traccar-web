import { useEffect, useMemo, useState } from 'react';
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
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
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
  normalizePlate,
  unknownPlates,
  withPlateAliases,
} from '../../common/fleet/fuelImport';
import VehicleSelect from '../../common/components/VehicleSelect';
import readSheet from '../../common/util/readSheet';
import { formatTime } from '../../common/util/formatter';
import { ensureVehicle, money } from '../fleetData';
import { keepOnBackdrop } from '../../common/util/formDialog';
import { pascalCase } from '../../common/util/stringUtils';

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

export const fuelFlagKey = (flag) => `fleetFuelFlag${pascalCase(flag)}`;

// ADM-18: the fuel companies, from a list (the company decides which transactions are the same
// one, so "דלק" and "Delek" must not be two companies). The mapping of each company's file is
// kept for the organization.
export const FUEL_PROVIDERS = ['delek', 'paz', 'sonol', 'ten', 'dor_alon', 'other'];

// Fuel company file -> fuel_transactions, with column mapping, preview and anomaly flags.
// Transactions already imported (same provider and transaction number) are skipped.
const FuelImportDialog = ({ onClose, onImported }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);

  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('');
  const [savedMappings, setSavedMappings] = useState({});
  const [rows, setRows] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  // ADM-18: plates of the file mapped to a vehicle by hand, kept with the company's columns.
  const [aliases, setAliases] = useState({});

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

  useEffect(() => {
    getFleetClient()
      .from('fuel_import_profiles')
      .select('provider, mapping')
      .then(({ data }) =>
        setSavedMappings(
          Object.fromEntries((data || []).map((row) => [row.provider, row.mapping])),
        ),
      );
  }, []);

  // A saved mapping by column name applies when this file has those columns.
  const mappingFor = (headerRow, company) => {
    // The plates mapped by hand are kept beside the columns, not as a column.
    const saved = Object.fromEntries(
      Object.entries(savedMappings[company] || {}).filter(([field]) => field !== 'plates'),
    );
    const guessed = guessColumns(headerRow);
    if (!Object.keys(saved).length) return guessed;
    const byName = Object.fromEntries(
      Object.entries(saved)
        .map(([field, name]) => [field, headerRow.findIndex((header) => String(header) === name)])
        .filter(([, index]) => index >= 0),
    );
    return { ...guessed, ...byName };
  };

  const load = useCatch(async (selected) => {
    setFile(selected);
    setResult(null);
    if (!selected) {
      setRows(null);
      return;
    }
    const all = await readSheet(selected);
    setRows(all);
    setMapping(mappingFor(all[0] || [], provider));
  });

  const chooseProvider = (company) => {
    setProvider(company);
    setAliases(savedMappings[company]?.plates || {});
    if (rows) setMapping(mappingFor(rows[0] || [], company));
  };

  const headers = rows?.[0] || [];
  const transactions = useMemo(
    () =>
      rows ? buildTransactions(rows.slice(1), mapping, withPlateAliases(vehicles, aliases)) : [],
    [rows, mapping, vehicles, aliases],
  );
  const platesToMap = [...new Set([...unknownPlates(transactions), ...Object.keys(aliases)])];
  const plateShown = (plate) =>
    transactions.find((tx) => normalizePlate(tx.plate_number) === plate)?.plate_number || plate;
  const valid = transactions.filter((tx) => !tx.errors.length);
  const mappedRequired = REQUIRED_FUEL_FIELDS.every((field) => mapping[field] !== undefined);

  const runImport = useCatch(async () => {
    setImporting(true);
    try {
      const client = getFleetClient();
      const source = provider || null;
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
      if (source) {
        // The next file of this company maps itself (by column name).
        const named = {
          ...Object.fromEntries(
            Object.entries(mapping).map(([field, index]) => [field, String(headers[index] ?? '')]),
          ),
          ...(Object.keys(aliases).length && { plates: aliases }),
        };
        await client
          .from('fuel_import_profiles')
          .upsert(
            { org_id: profile.org_id, provider: source, mapping: named },
            { onConflict: 'org_id,provider' },
          );
      }
      setResult({
        batch,
        imported: payload.length,
        duplicates: valid.length - fresh.length,
        invalid: transactions.length - valid.length,
      });
      onImported();
    } finally {
      setImporting(false);
    }
  });

  // The whole file comes out again, by its batch.
  const undo = useCatch(async () => {
    unwrap(
      await getFleetClient().from('fuel_transactions').delete().eq('import_batch', result.batch),
    );
    setResult({ ...result, undone: true });
    onImported();
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="md">
      <DialogTitle>{t('fleetFuelImport')}</DialogTitle>
      <DialogContent>
        <div className={classes.body}>
          <Typography variant="body2" color="textSecondary">
            {t('fleetFuelImportHint')}
          </Typography>
          <div className={classes.mapping}>
            <TextField
              select
              label={t('fleetFuelProvider')}
              value={provider}
              onChange={(event) => chooseProvider(event.target.value)}
              helperText={savedMappings[provider] ? t('fleetFuelMappingSaved') : undefined}
            >
              {FUEL_PROVIDERS.map((company) => (
                <MenuItem key={company} value={company}>
                  {t(`fleetFuelProvider${pascalCase(company)}`)}
                </MenuItem>
              ))}
            </TextField>
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
                    label={t(`fleetFuelField${pascalCase(field)}`)}
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
              {platesToMap.length > 0 && (
                <>
                  <Typography variant="subtitle2">{t('fleetFuelUnknownPlates')}</Typography>
                  <div className={classes.mapping}>
                    {platesToMap.map((plate) => (
                      <VehicleSelect
                        key={plate}
                        label={t('fleetFuelPlateIs').replace('{0}', plateShown(plate))}
                        value={aliases[plate] ? String(aliases[plate]) : ''}
                        onChange={(deviceId) => {
                          const next = { ...aliases };
                          if (deviceId) next[plate] = Number(deviceId);
                          else delete next[plate];
                          setAliases(next);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
              <Alert severity={valid.length ? 'info' : 'warning'}>
                {t('fleetFuelPreviewSummary')
                  .replace('{0}', String(valid.length))
                  .replace('{1}', String(transactions.length - valid.length))
                  .replace('{2}', String(valid.filter((tx) => tx.flags.length).length))}
              </Alert>
              <div className={classes.preview}>
                <ResponsiveTable size="small" stickyHeader>
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
                            {tx.errors.map((error) => (
                              <Chip
                                key={error}
                                size="small"
                                color="error"
                                label={t(`fleetFuelRowInvalid${pascalCase(error)}`)}
                              />
                            ))}
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
                </ResponsiveTable>
              </div>
            </>
          )}
          {result && !result.undone && (
            <Alert
              severity="success"
              action={
                result.imported > 0 && (
                  <Button color="inherit" size="small" onClick={undo}>
                    {t('fleetFuelUndoImport')}
                  </Button>
                )
              }
            >
              {t('fleetFuelImported')
                .replace('{0}', String(result.imported))
                .replace('{1}', String(result.duplicates))
                .replace('{2}', String(result.invalid))}
            </Alert>
          )}
          {result?.undone && <Alert severity="info">{t('fleetFuelImportUndone')}</Alert>}
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

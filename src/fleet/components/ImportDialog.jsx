import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import {
  IMPORT_KINDS,
  buildImportRows,
  guessImportColumns,
  importFields,
} from '../../common/fleet/bulkImport';
import readSheet from '../../common/util/readSheet';
import downloadFile from '../../common/util/downloadFile';
import { keepOnBackdrop } from '../../common/util/formDialog';

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
  problems: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
}));

// The label of each column, per kind.
export const IMPORT_LABELS = {
  name: 'sharedName',
  uniqueId: 'deviceIdentifier',
  plateNumber: 'fleetPlateNumber',
  phone: 'sharedPhone',
  model: 'importDeviceModel',
  make: 'fleetMake',
  vehicleModel: 'fleetVehicleModel',
  modelYear: 'fleetModelYear',
  group: 'groupParent',
  testExpiry: 'fleetTestExpiry',
  insuranceCompulsoryExpiry: 'fleetInsuranceCompulsoryExpiry',
  nationalId: 'fleetNationalId',
  email: 'userEmail',
  licenseNumber: 'fleetLicenseNumber',
  licenseExpiry: 'fleetLicenseExpiry',
  latitude: 'positionLatitude',
  longitude: 'positionLongitude',
  radius_m: 'fleetPoiRadius',
  address: 'positionAddress',
  contact_name: 'fleetVendorContact',
};

const TITLES = { vehicles: 'importVehicles', drivers: 'importDrivers', pois: 'importPois' };

// ADM-13: a spreadsheet of vehicles, drivers or points of interest: the file, the columns, a
// preview with what is wrong in each row, and the import. `save(values)` adds one row (it throws
// to report the row as failed); `existing` is what is already in the system.
const ImportDialog = ({ kind, existing, save, onClose, onImported }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const fields = importFields(kind);
  const required = IMPORT_KINDS[kind].required;

  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [mapping, setMapping] = useState({});
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCatch(async (selected) => {
    setFile(selected);
    setResult(null);
    if (!selected) {
      setRows(null);
      return;
    }
    const all = await readSheet(selected);
    setRows(all);
    setMapping(guessImportColumns(kind, all[0] || []));
  });

  const headers = rows?.[0] || [];
  const checked = useMemo(
    () => (rows ? buildImportRows(kind, rows.slice(1), mapping, existing) : []),
    [kind, rows, mapping, existing],
  );
  const ready = checked.filter((row) => !row.errors.length && !row.duplicate);
  const invalid = checked.filter((row) => row.errors.length).length;
  const duplicates = checked.filter((row) => !row.errors.length && row.duplicate).length;
  const mappedRequired = required.every((field) => mapping[field] !== undefined);

  const template = () => {
    const line = fields.map((field) => `"${t(IMPORT_LABELS[field])}"`).join(',');
    downloadFile(`${kind}.csv`, new Blob([`\uFEFF${line}\n`], { type: 'text/csv' }));
  };

  const runImport = useCatch(async () => {
    const failed = [];
    let added = 0;
    setProgress(0);
    try {
      // One at a time: each row is its own request, and a failure is reported by line.
      for (const row of ready) {
        try {
          await save(row.values);
          added += 1;
        } catch (error) {
          failed.push({ line: row.line, message: error?.message || String(error) });
        }
        setProgress((value) => value + 1);
      }
    } finally {
      setProgress(null);
    }
    setResult({ added, failed, duplicates, invalid });
    if (added) onImported();
  });

  const problem = (row) => [
    ...row.errors.map((error) => (
      <Chip
        key={`${error.field}-${error.key}`}
        size="small"
        color="error"
        variant="outlined"
        label={`${t(IMPORT_LABELS[error.field])}: ${t(error.key)}`}
      />
    )),
    ...(row.duplicate
      ? [<Chip key="duplicate" size="small" variant="outlined" label={t(row.duplicate)} />]
      : []),
  ];

  const shown = fields.filter((field) => mapping[field] !== undefined).slice(0, 4);

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="md">
      <DialogTitle>{t(TITLES[kind])}</DialogTitle>
      <DialogContent>
        <div className={classes.body}>
          <Typography variant="body2" color="textSecondary">
            {t('importHint')}{' '}
            <Link component="button" type="button" onClick={template}>
              {t('importTemplate')}
            </Link>
          </Typography>
          <FileInput
            placeholder={t('importFile')}
            value={file}
            onChange={load}
            slotProps={{ htmlInput: { accept: '.csv,.xlsx,text/csv' } }}
          />
          {rows && !result && (
            <>
              <Typography variant="subtitle2">{t('fleetFuelColumns')}</Typography>
              <div className={classes.mapping}>
                {fields.map((field) => (
                  <TextField
                    key={field}
                    select
                    size="small"
                    label={t(IMPORT_LABELS[field])}
                    value={mapping[field] ?? ''}
                    required={required.includes(field)}
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
              <Alert severity={ready.length ? 'info' : 'warning'} role="status">
                {t('importSummary')
                  .replace('{0}', ready.length)
                  .replace('{1}', invalid)
                  .replace('{2}', duplicates)}
              </Alert>
              <div className={classes.preview}>
                <ResponsiveTable size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('importLine')}</TableCell>
                      {shown.map((field) => (
                        <TableCell key={field}>{t(IMPORT_LABELS[field])}</TableCell>
                      ))}
                      <TableCell>{t('importProblems')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {checked.slice(0, 100).map((row) => (
                      <TableRow key={row.line}>
                        <TableCell>{row.line}</TableCell>
                        {shown.map((field) => (
                          <TableCell key={field}>
                            <bdi>{row.values[field] ?? '—'}</bdi>
                          </TableCell>
                        ))}
                        <TableCell>
                          <span className={classes.problems}>{problem(row)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ResponsiveTable>
              </div>
            </>
          )}
          {progress != null && (
            <LinearProgress
              variant="determinate"
              value={(progress / Math.max(ready.length, 1)) * 100}
              aria-label={t('importProgress')}
            />
          )}
          {result && (
            <>
              <Alert severity={result.failed.length ? 'warning' : 'success'} role="status">
                {t('importResult')
                  .replace('{0}', result.added)
                  .replace('{1}', result.duplicates)
                  .replace('{2}', result.invalid)}
              </Alert>
              {result.failed.length > 0 && (
                <Alert severity="error">
                  {t('importFailed').replace('{0}', result.failed.length)}
                  <ul>
                    {result.failed.slice(0, 10).map((item) => (
                      <li key={item.line}>
                        {t('importLine')} {item.line}: {item.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={progress != null}>
          {t(result ? 'adminClose' : 'sharedCancel')}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={runImport}
            disabled={!rows || !mappedRequired || !ready.length || progress != null}
          >
            {t('importAction').replace('{0}', ready.length)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DocumentScannerRoundedIcon from '@mui/icons-material/DocumentScannerRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { aiErrorKey, aiRequest } from '../../common/fleet/ai';
import { shrinkImage } from '../../common/fleet/outbox';
import { useAiAvailable } from '../../common/fleet/useAi';
import { keepOnBackdrop } from '../../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  value: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    // A Latin value keeps its own direction but lines up with the Hebrew ones ('left' is the
    // page's start: the RTL plugin turns it into 'right').
    '& > span:first-of-type': {
      unicodeBidi: 'plaintext',
      textAlign: 'left',
    },
  },
  unsure: {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const SCAN_LABELS = {
  plate_number: 'fleetPlateNumber',
  test_expiry: 'fleetTestExpiry',
  make: 'fleetMake',
  model: 'fleetVehicleModel',
  model_year: 'fleetModelYear',
  vin: 'fleetVin',
  owner_name: 'scanOwnerName',
  insurer: 'scanInsurer',
  policy_number: 'scanPolicyNumber',
  kind: 'scanPolicyKind',
  valid_from: 'scanValidFrom',
  valid_until: 'scanValidUntil',
  full_name: 'sharedName',
  national_id: 'fleetNationalId',
  license_number: 'fleetLicenseNumber',
  license_classes: 'fleetLicenseClasses',
  expiry: 'fleetLicenseExpiry',
  vendor_name: 'scanVendor',
  invoice_number: 'fleetInvoiceNumber',
  date: 'scanDate',
  odometer: 'scanOdometer',
  lines: 'scanLines',
  subtotal: 'scanSubtotal',
  vat: 'scanVat',
  total: 'fleetWorkOrderTotal',
};

const KIND_TITLES = {
  vehicle_license: 'scanVehicleLicense',
  insurance: 'scanInsurance',
  driver_license: 'scanDriverLicense',
  garage_invoice: 'scanGarageInvoice',
};

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// AI-04: a photo or scan of a document fills the form. The model reads it, the user sees every
// value with the unsure ones marked, and only "fill the form" puts them in; saving the form is
// still the user's own step. `onApply({ fields, unsure }, file)`.
const ScanDocumentButton = ({ kind, onApply, label }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const available = useAiAvailable();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reading, setReading] = useState(false);

  if (!available) return null;

  const read = async (selected) => {
    setFile(selected);
    setResult(null);
    setError(null);
    setReading(true);
    try {
      const small =
        selected.type === 'application/pdf' ? selected : await shrinkImage(selected, 2000);
      setResult(
        await aiRequest('extract', {
          kind,
          media_type: small.type || 'image/jpeg',
          data: await toBase64(small),
        }),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setReading(false);
    }
  };

  const close = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const shown = (value) => {
    if (Array.isArray(value)) {
      return value.length && typeof value[0] === 'object'
        ? t('scanLineCount').replace('{0}', value.length)
        : value.join(', ');
    }
    return value == null || value === '' ? '—' : String(value);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<DocumentScannerRoundedIcon />}
        onClick={() => inputRef.current?.click()}
      >
        {label || t('scanAction')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*,application/pdf"
        aria-label={label || t('scanAction')}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = '';
          if (selected) read(selected);
        }}
      />
      {file && (
        <Dialog open onClose={keepOnBackdrop(close)} fullWidth maxWidth="sm">
          <DialogTitle>{t(KIND_TITLES[kind])}</DialogTitle>
          <DialogContent>
            {reading && (
              <>
                <LinearProgress aria-label={t('scanReading')} />
                <Typography variant="body2" color="textSecondary" role="status" sx={{ mt: 1 }}>
                  {t('scanReading')}
                </Typography>
              </>
            )}
            {error && <Alert severity="warning">{t(aiErrorKey(error))}</Alert>}
            {result && (
              <>
                <Alert severity={result.unsure.length ? 'warning' : 'info'} role="status">
                  {result.unsure.length
                    ? t('scanCheckMarked').replace('{0}', result.unsure.length)
                    : t('scanCheckAll')}
                </Alert>
                <Table size="small">
                  <TableBody>
                    {Object.entries(result.fields).map(([key, value]) => {
                      const unsure = result.unsure.includes(key);
                      return (
                        <TableRow key={key} className={cx(unsure && classes.unsure)}>
                          <TableCell component="th" scope="row">
                            {t(SCAN_LABELS[key] || key)}
                          </TableCell>
                          <TableCell>
                            <div className={classes.value}>
                              <span>{shown(value)}</span>
                              {unsure && (
                                <Chip
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  label={t('scanUnsure')}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>{t('sharedCancel')}</Button>
            <Button
              variant="contained"
              disabled={!result}
              onClick={() => {
                onApply(result, file);
                close();
              }}
            >
              {t('scanFill')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default ScanDocumentButton;

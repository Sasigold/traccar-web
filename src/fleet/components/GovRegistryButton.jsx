import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { vehicleExpiryFields, vehicleFields } from '../../common/fleet/fleetFields';
import {
  lookupVehicle,
  registryChanges,
  registryToFields,
  validPlate,
} from '../../common/fleet/govRegistry';
import { formatTime } from '../../common/util/formatter';
import { capitalize } from '../../common/util/stringUtils';

const FIELDS = Object.fromEntries(
  [...vehicleFields, ...vehicleExpiryFields].map((field) => [field.key, field]),
);

const display = (t, key, value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const field = FIELDS[key];
  if (field?.type === 'date') {
    return formatTime(value, 'date');
  }
  if (field?.optionPrefix) {
    return t(`${field.optionPrefix}${capitalize(String(value))}`);
  }
  return String(value);
};

// "Fill from the government registry" on the vehicle card: looks the plate up on data.gov.il and
// shows what would change (make, model, year, VIN, fuel, ownership, test expiry) before applying.
// Nothing is saved until the card is saved.
const GovRegistryButton = ({ attributes, setAttributes }) => {
  const t = useTranslation();
  const plate = attributes?.plateNumber;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const lookup = useCatch(async () => {
    setLoading(true);
    try {
      const record = await lookupVehicle(plate);
      const fields = registryToFields(record);
      setResult({ found: Boolean(record), fields, changes: registryChanges(attributes, fields) });
    } finally {
      setLoading(false);
    }
  });

  const apply = () => {
    setAttributes({ ...attributes, ...result.fields });
    setResult(null);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<CloudDownloadRoundedIcon />}
        onClick={lookup}
        disabled={!validPlate(plate) || loading}
        title={validPlate(plate) ? undefined : t('govRegistryNeedPlate')}
      >
        {loading ? t('sharedLoading') : t('govRegistryFill')}
      </Button>
      <Dialog open={Boolean(result)} onClose={() => setResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('govRegistryTitle')}</DialogTitle>
        <DialogContent>
          {result && !result.found && <Alert severity="info">{t('govRegistryNotFound')}</Alert>}
          {result?.found && !result.changes.length && (
            <Alert severity="success">{t('govRegistryUpToDate')}</Alert>
          )}
          {result?.changes.length > 0 && (
            <Table size="small" aria-label={t('govRegistryTitle')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('govRegistryField')}</TableCell>
                  <TableCell>{t('govRegistryCurrent')}</TableCell>
                  <TableCell>{t('govRegistryNew')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.changes.map(({ key, from, to }) => (
                  <TableRow key={key}>
                    <TableCell>{t(FIELDS[key]?.labelKey)}</TableCell>
                    <TableCell>
                      <bdi>{display(t, key, from)}</bdi>
                    </TableCell>
                    <TableCell>
                      <strong>
                        <bdi>{display(t, key, to)}</bdi>
                      </strong>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResult(null)}>{t('sharedCancel')}</Button>
          {result?.changes.length > 0 && (
            <Button variant="contained" onClick={apply}>
              {t('govRegistryApply')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GovRegistryButton;

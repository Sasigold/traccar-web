import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from '../LocalizationProvider';
import { adjustValue, isNumber } from './vehicleProfile';

const toNumber = (text) => (text === '' || text == null ? null : Number(text));

const formatPreview = (value, unit) => {
  if (!isNumber(value)) return value == null ? '–' : String(value);
  return `${Number(value.toFixed(3))}${unit ? ` ${unit}` : ''}`;
};

// Name, scale, unit and visibility of one dashboard parameter.
const ParameterDialog = ({ open, paramKey, defaultLabel, value, config, onClose, onApply }) => {
  const t = useTranslation();
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (open) {
      setDraft({
        label: config?.label || '',
        factor: config?.factor ?? '',
        offset: config?.offset ?? '',
        unit: config?.unit || '',
        hidden: Boolean(config?.hidden),
      });
    }
    // Load once per opening; live updates must not reset the draft.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [open, paramKey]);

  const result = {
    label: draft.label?.trim() || null,
    factor: toNumber(draft.factor),
    offset: toNumber(draft.offset),
    unit: draft.unit?.trim() || null,
    hidden: draft.hidden || null,
  };
  const valid = [result.factor, result.offset].every((n) => n == null || Number.isFinite(n));
  const numeric = isNumber(value);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('parameterEdit')}
        <Typography
          variant="body2"
          color="textSecondary"
          component="div"
          dir="ltr"
          sx={{ textAlign: 'start' }}
        >
          {paramKey}
        </Typography>
      </DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}
      >
        <TextField
          label={t('parameterName')}
          placeholder={defaultLabel}
          value={draft.label || ''}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {numeric && (
          <>
            <TextField
              type="number"
              label={t('parameterFactor')}
              placeholder="1"
              helperText={t('parameterFactorHelp')}
              value={draft.factor}
              onChange={(e) => setDraft({ ...draft, factor: e.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 'any', dir: 'ltr' } }}
            />
            <TextField
              type="number"
              label={t('parameterOffset')}
              placeholder="0"
              value={draft.offset}
              onChange={(e) => setDraft({ ...draft, offset: e.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 'any', dir: 'ltr' } }}
            />
            <TextField
              label={t('parameterUnit')}
              placeholder={t('parameterUnitPlaceholder')}
              value={draft.unit || ''}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
        <FormControlLabel
          control={
            <Switch
              checked={!draft.hidden}
              onChange={(e) => setDraft({ ...draft, hidden: !e.target.checked })}
            />
          }
          label={t('parameterVisible')}
        />
        {value != null && (
          <Typography variant="body2" color="textSecondary">
            {t('parameterRaw')}: <bdi>{formatPreview(value)}</bdi>
            {' · '}
            {t('parameterPreview')}:{' '}
            <strong>
              <bdi>{formatPreview(adjustValue(value, result), result.unit)}</bdi>
            </strong>
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={() => onApply(null)}>
          {t('parameterReset')}
        </Button>
        <span style={{ flex: 1 }} />
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {t('sharedCancel')}
        </Button>
        <Button variant="contained" disabled={!valid} onClick={() => onApply(result)}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ParameterDialog;

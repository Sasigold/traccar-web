import { useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { fleetSave } from '../../common/fleet/fleetSave';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { DEFAULT_CHECKLIST, FREQUENCIES, ITEM_TYPES } from '../../common/fleet/inspections';
import { keepOnBackdrop } from '../../common/util/formDialog';
import { pascalCase } from '../../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  item: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 150px auto auto',
    gap: theme.spacing(1),
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr) auto',
    },
  },
  range: {
    display: 'flex',
    gap: theme.spacing(1),
    gridColumn: '1 / -1',
  },
}));

export const itemTypeKey = (type) => `fleetInspectionItemType${pascalCase(type)}`;
export const frequencyKey = (frequency) => `fleetInspectionFrequency${pascalCase(frequency)}`;

const withKeys = (items) => items.map((item) => ({ ...item, key: item.id || crypto.randomUUID() }));

// A checklist template and its items; a new one starts from the default daily checklist.
const InspectionTemplateDialog = ({ template, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(() => ({
    name: template.name || '',
    frequency: template.frequency || 'daily',
    active: template.active ?? true,
  }));
  const [items, setItems] = useState(() =>
    withKeys(template.id ? template.inspection_template_items || [] : DEFAULT_CHECKLIST),
  );

  const setItem = (key, changes) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );

  const save = useCatch(async () => {
    const payload = { name: form.name.trim(), frequency: form.frequency, active: form.active };
    const rows = items
      .filter((item) => item.label?.trim())
      .map((item) => ({
        label: item.label.trim(),
        type: item.type,
        critical: Boolean(item.critical),
        min_value:
          item.type === 'number_range' && item.min_value !== '' ? (item.min_value ?? null) : null,
        max_value:
          item.type === 'number_range' && item.max_value !== '' ? (item.max_value ?? null) : null,
      }));
    // ARC-05: the template and its items in one transaction. Filled inspections keep their own
    // copy of each label.
    await fleetSave(
      'inspection_template',
      template.id,
      template.id ? payload : { ...payload, org_id: profile.org_id },
      rows,
    );
    onSaved();
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="md">
      <DialogTitle>
        {t(template.id ? 'fleetInspectionTemplateEdit' : 'fleetInspectionTemplateAdd')}
      </DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            label={t('sharedName')}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            select
            label={t('fleetInspectionFrequency')}
            value={form.frequency}
            onChange={(event) => setForm({ ...form, frequency: event.target.value })}
          >
            {FREQUENCIES.map((frequency) => (
              <MenuItem key={frequency} value={frequency}>
                {t(frequencyKey(frequency))}
              </MenuItem>
            ))}
          </TextField>
          {items.map((item) => (
            <div key={item.key} className={classes.item}>
              <TextField
                size="small"
                label={t('fleetInspectionItem')}
                value={item.label}
                onChange={(event) => setItem(item.key, { label: event.target.value })}
              />
              <TextField
                select
                size="small"
                label={t('sharedType')}
                value={item.type}
                onChange={(event) => setItem(item.key, { type: event.target.value })}
              >
                {ITEM_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {t(itemTypeKey(type))}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(item.critical)}
                    onChange={(event) => setItem(item.key, { critical: event.target.checked })}
                  />
                }
                label={t('fleetInspectionCritical')}
              />
              <IconButton
                aria-label={t('sharedRemove')}
                onClick={() => setItems((current) => current.filter((it) => it.key !== item.key))}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
              {item.type === 'number_range' && (
                <div className={classes.range}>
                  <TextField
                    size="small"
                    type="number"
                    label={t('fleetInspectionMin')}
                    value={item.min_value ?? ''}
                    onChange={(event) => setItem(item.key, { min_value: event.target.value })}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label={t('fleetInspectionMax')}
                    value={item.max_value ?? ''}
                    onChange={(event) => setItem(item.key, { max_value: event.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            startIcon={<AddRoundedIcon />}
            sx={{ alignSelf: 'flex-start' }}
            onClick={() =>
              setItems((current) => [
                ...current,
                { key: crypto.randomUUID(), label: '', type: 'pass_fail', critical: false },
              ])
            }
          >
            {t('fleetInspectionAddItem')}
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
            }
            label={t('fleetRecipientActive')}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={!form.name.trim() || !items.some((item) => item.label?.trim())}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InspectionTemplateDialog;

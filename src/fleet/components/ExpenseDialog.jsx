import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { ensureVehicle, uploadFleetFile } from '../fleetData';
import { DateField } from '../../common/components/pickers';
import { keepOnBackdrop } from '../../common/util/formDialog';
import MoneyField from '../../common/components/MoneyField';
import { capitalize } from '../../common/util/stringUtils';
import VehicleSelect from '../../common/components/VehicleSelect';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

export const EXPENSE_CATEGORIES = [
  'toll',
  'parking',
  'fine',
  'registration',
  'insurance',
  'lease',
  'wash',
  'tires',
  'other',
];
export const expenseCategoryKey = (category) => `fleetExpenseCategory${capitalize(category)}`;

const today = () => new Date().toISOString().slice(0, 10);

// A single expense (toll, parking, fine, wash ...) with an optional receipt.
// ADM-18: with `expense`, the row is edited (its vehicle given as `deviceId`, the Traccar id).
const ExpenseDialog = ({ expense, deviceId, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const [form, setForm] = useState(() =>
    expense
      ? {
          deviceId: deviceId ? String(deviceId) : '',
          category: expense.category,
          occurred_at: String(expense.occurred_at).slice(0, 10),
          amount: String(expense.amount ?? ''),
          reference: expense.reference || '',
          notes: expense.notes || '',
        }
      : {
          deviceId: '',
          category: 'toll',
          occurred_at: today(),
          amount: '',
          reference: '',
          notes: '',
        },
  );
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const vehicleId = form.deviceId ? await ensureVehicle(devices[form.deviceId], profile) : null;
      const receiptPath = receipt
        ? await uploadFleetFile(profile.org_id, 'expenses', receipt)
        : null;
      const values = {
        vehicle_id: vehicleId,
        category: form.category,
        occurred_at: form.occurred_at,
        amount: Number(form.amount),
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      };
      const table = getFleetClient().from('vehicle_expenses');
      if (expense) {
        unwrap(
          await table
            .update({ ...values, ...(receiptPath && { receipt_path: receiptPath }) })
            .eq('id', expense.id),
        );
      } else {
        unwrap(
          await table.insert({
            ...values,
            org_id: profile.org_id,
            receipt_path: receiptPath,
            created_by: profile.id,
          }),
        );
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  });

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t(expense ? 'fleetExpenseEdit' : 'fleetExpenseAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <VehicleSelect
            devices={options}
            value={form.deviceId}
            onChange={(deviceId) => set('deviceId')({ target: { value: deviceId } })}
          />
          <TextField
            select
            label={t('fleetExpenseCategory')}
            value={form.category}
            onChange={set('category')}
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <MenuItem key={category} value={category}>
                {t(expenseCategoryKey(category))}
              </MenuItem>
            ))}
          </TextField>
          <DateField
            label={t('fleetExpenseDate')}
            value={form.occurred_at}
            onChange={set('occurred_at')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <MoneyField
            label={t('fleetExpenseAmount')}
            value={form.amount}
            onChange={set('amount')}
          />
          <TextField
            label={t('fleetExpenseReference')}
            value={form.reference}
            onChange={set('reference')}
          />
          <TextField
            label={t('fleetNotes')}
            value={form.notes}
            onChange={set('notes')}
            multiline
            minRows={2}
          />
          <FileInput
            placeholder={t('fleetExpenseReceipt')}
            value={receipt}
            onChange={setReceipt}
            slotProps={{ htmlInput: { accept: 'image/*,application/pdf' } }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || !form.occurred_at || !(Number(form.amount) > 0)}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExpenseDialog;

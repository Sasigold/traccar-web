import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { odometerKm } from '../../common/fleet/workOrders';
import { fromLocalInput, toLocalInput } from '../../common/fleet/incidents';
import { ensureVehicle, uploadFleetFile } from '../fleetData';
import FileInput from '../../common/components/FileInput';
import { keepOnBackdrop } from '../../common/util/formDialog';
import MoneyField from '../../common/components/MoneyField';
import VehicleSelect from '../../common/components/VehicleSelect';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

// ADM-18: one fueling paid in cash or by credit card, so the cost per km counts it. The odometer
// is suggested from the vehicle's last position.
const FuelEntryDialog = ({ onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const [form, setForm] = useState(() => ({
    deviceId: '',
    occurred_at: toLocalInput(),
    liters: '',
    total: '',
    odometer: '',
    station: '',
  }));
  const [saving, setSaving] = useState(false);
  // ADM-18: the receipt's photo, kept with the row.
  const [receipt, setReceipt] = useState(null);

  const options = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const chooseVehicle = (event) => {
    const deviceId = event.target.value;
    const suggested = odometerKm(positions[deviceId]);
    setForm({
      ...form,
      deviceId,
      odometer: form.odometer || suggested == null ? form.odometer : String(suggested),
    });
  };

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const device = devices[form.deviceId];
      const liters = Number(form.liters) || null;
      const total = Number(form.total);
      const receiptPath = receipt ? await uploadFleetFile(profile.org_id, 'fuel', receipt) : null;
      unwrap(
        await getFleetClient()
          .from('fuel_transactions')
          .insert({
            org_id: profile.org_id,
            vehicle_id: await ensureVehicle(device, profile),
            occurred_at: fromLocalInput(form.occurred_at),
            liters,
            total,
            unit_price: liters ? Math.round((total / liters) * 100) / 100 : null,
            odometer_reported: Number(form.odometer) || null,
            station: form.station.trim() || null,
            plate_number: device.attributes?.plateNumber || null,
            fuel_type: device.attributes?.fuelType || null,
            source: 'manual',
            receipt_path: receiptPath,
            created_by: profile.id,
          }),
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t('fleetFuelManual')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <VehicleSelect
            required
            devices={options}
            value={form.deviceId}
            onChange={(deviceId) => chooseVehicle({ target: { value: deviceId } })}
          />
          <TextField
            type="datetime-local"
            required
            label={t('fleetFuelFieldOccurredAt')}
            value={form.occurred_at}
            onChange={set('occurred_at')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="number"
            label={t('fleetFuelFieldLiters')}
            value={form.liters}
            onChange={set('liters')}
            slotProps={{ htmlInput: { min: 0, step: 0.01, dir: 'ltr' } }}
          />
          <MoneyField
            required
            label={t('fleetFuelFieldTotal')}
            value={form.total}
            onChange={set('total')}
          />
          <TextField
            type="number"
            label={t('fleetFuelOdometer')}
            value={form.odometer}
            onChange={set('odometer')}
            helperText={t('fleetFuelOdometerHelp')}
            slotProps={{ htmlInput: { min: 0, dir: 'ltr' } }}
          />
          <TextField
            label={t('fleetFuelFieldStation')}
            value={form.station}
            onChange={set('station')}
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
          disabled={saving || !form.deviceId || !form.occurred_at || !(Number(form.total) > 0)}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FuelEntryDialog;

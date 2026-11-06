import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import { messagesActions } from '../../store';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { fromLocalInput, toLocalInput } from '../../common/fleet/incidents';
import { ensureDriver, ensureVehicle, uploadFleetFile } from '../fleetData';
import { whoDrove } from '../safetyData';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  full: {
    gridColumn: '1 / -1',
  },
}));

export const VIOLATION_TYPES = [
  'speeding',
  'red_light',
  'parking',
  'phone',
  'seatbelt',
  'lane',
  'other',
];
export const VIOLATION_STATUSES = ['open', 'assigned', 'transferred', 'paid', 'appealed', 'closed'];
const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
export const violationKey = (group, value) => `fleetViolation${group}${camel(value)}`;

// A traffic or parking violation; "who drove?" finds the driver from the track (report transfer).
const ViolationDialog = ({ onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const driversById = useMemo(
    () => Object.fromEntries(Object.values(drivers).map((driver) => [driver.id, driver])),
    [drivers],
  );
  const [form, setForm] = useState(() => ({
    deviceId: '',
    driverId: '',
    occurred_at: toLocalInput(),
    type: 'speeding',
    authority: '',
    reference_no: '',
    location: '',
    fine_amount: '',
    points: '',
    status: 'open',
    due_at: '',
    notes: '',
  }));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const findDriver = useCatch(async () => {
    setBusy(true);
    try {
      const driver = await whoDrove(
        Number(form.deviceId),
        Date.parse(fromLocalInput(form.occurred_at)),
        drivers,
        driversById,
      );
      if (driver) {
        setForm((current) => ({
          ...current,
          driverId: String(driver.id),
          status: current.status === 'open' ? 'assigned' : current.status,
        }));
      } else {
        dispatch(messagesActions.push(t('fleetViolationDriverUnknown')));
      }
    } finally {
      setBusy(false);
    }
  });

  const save = useCatch(async () => {
    setBusy(true);
    try {
      const driver = form.driverId ? driversById[form.driverId] : null;
      const nullable = (value) => (value === '' ? null : value);
      unwrap(
        await getFleetClient()
          .from('driver_violations')
          .insert({
            org_id: profile.org_id,
            vehicle_id: form.deviceId ? await ensureVehicle(devices[form.deviceId], profile) : null,
            driver_id: driver ? await ensureDriver(driver, profile) : null,
            occurred_at: fromLocalInput(form.occurred_at),
            type: form.type,
            authority: nullable(form.authority.trim()),
            reference_no: nullable(form.reference_no.trim()),
            location: nullable(form.location.trim()),
            fine_amount: nullable(form.fine_amount),
            points: nullable(form.points),
            status: form.status,
            due_at: nullable(form.due_at),
            notes: nullable(form.notes.trim()),
            document_path: file ? await uploadFleetFile(profile.org_id, 'safety', file) : null,
            created_by: profile.id,
          }),
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('fleetViolationAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            select
            label={t('fleetEntityVehicle')}
            value={form.deviceId}
            onChange={set('deviceId')}
          >
            {Object.values(devices)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((device) => (
                <MenuItem key={device.id} value={String(device.id)}>
                  {device.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            type="datetime-local"
            label={t('fleetIncidentOccurred')}
            value={form.occurred_at}
            onChange={set('occurred_at')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={t('sharedDriver')}
            value={form.driverId}
            onChange={set('driverId')}
          >
            <MenuItem value="">&nbsp;</MenuItem>
            {Object.values(drivers)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((driver) => (
                <MenuItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </MenuItem>
              ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<PersonSearchRoundedIcon />}
            onClick={findDriver}
            disabled={!form.deviceId || busy}
          >
            {t('fleetViolationWhoDrove')}
          </Button>
          <TextField select label={t('sharedType')} value={form.type} onChange={set('type')}>
            {VIOLATION_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(violationKey('Type', type))}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t('deviceStatus')} value={form.status} onChange={set('status')}>
            {VIOLATION_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {t(violationKey('Status', status))}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('fleetViolationAuthority')}
            value={form.authority}
            onChange={set('authority')}
          />
          <TextField
            label={t('fleetViolationReference')}
            value={form.reference_no}
            onChange={set('reference_no')}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <TextField
            type="number"
            label={t('fleetViolationFine')}
            value={form.fine_amount}
            onChange={set('fine_amount')}
            slotProps={{ htmlInput: { dir: 'ltr', step: 'any' } }}
          />
          <TextField
            type="number"
            label={t('fleetViolationPoints')}
            value={form.points}
            onChange={set('points')}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <TextField
            type="date"
            label={t('fleetViolationDue')}
            value={form.due_at}
            onChange={set('due_at')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label={t('positionAddress')}
            value={form.location}
            onChange={set('location')}
          />
          <TextField
            className={classes.full}
            label={t('fleetNotes')}
            value={form.notes}
            onChange={set('notes')}
            multiline
            minRows={2}
          />
          <div className={classes.full}>
            <FileInput
              placeholder={t('fleetViolationDocument')}
              value={file}
              onChange={setFile}
              slotProps={{ htmlInput: { accept: 'image/*,application/pdf' } }}
            />
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !form.occurred_at}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViolationDialog;

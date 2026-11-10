import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import { messagesActions } from '../../store';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { fromLocalInput, toLocalInput } from '../../common/fleet/incidents';
import { ensureDriver, ensureVehicle, money, uploadFleetFile } from '../fleetData';
import { whoDrove } from '../safetyData';
import { DateField, DateTimeField } from '../../common/components/pickers';
import { formatTime } from '../../common/util/formatter';
import {
  companyPenalty,
  transferDeadline,
  transferLetter,
  violationUrgency,
} from '../../common/fleet/violations';
import printTransferLetter, { openLetterWindow } from './printTransferLetter';
import { keepOnBackdrop } from '../../common/util/formDialog';
import { pascalCase } from '../../common/util/stringUtils';

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
  actions: {
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    '& .MuiButton-root': {
      whiteSpace: 'nowrap',
    },
  },
  actionsEnd: {
    display: 'flex',
    gap: theme.spacing(1),
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
export const violationKey = (group, value) => `fleetViolation${group}${pascalCase(value)}`;

const OPEN_STATUSES = ['open', 'assigned'];

// The form fields for a new ticket, or for one already in the database.
const initialForm = (violation, devices) => {
  if (!violation) {
    return {
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
      received_at: '',
      due_at: '',
      charge_driver: false,
      charged_at: '',
      notes: '',
    };
  }
  const deviceId = violation.vehicles?.traccar_device_id;
  const text = (value) => (value == null ? '' : String(value));
  return {
    deviceId: deviceId != null && devices[deviceId] ? String(deviceId) : '',
    driverId: text(violation.drivers?.traccar_driver_id),
    occurred_at: toLocalInput(violation.occurred_at),
    type: violation.type,
    authority: text(violation.authority),
    reference_no: text(violation.reference_no),
    location: text(violation.location),
    fine_amount: text(violation.fine_amount),
    points: text(violation.points),
    status: violation.status,
    received_at: text(violation.received_at),
    due_at: text(violation.due_at),
    charge_driver: Boolean(violation.charge_driver),
    charged_at: text(violation.charged_at),
    notes: text(violation.notes),
  };
};

// A traffic or parking ticket. "Who drove?" finds the driver from the track; the deadline to
// name the driver runs from the day the notice arrived, and the letter to the authority prints
// from here (ISR-02). With `violation` the dialog edits that ticket.
const ViolationDialog = ({ violation, onClose, onSaved }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const dispatch = useDispatch();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const driversById = useMemo(
    () => Object.fromEntries(Object.values(drivers).map((driver) => [driver.id, driver])),
    [drivers],
  );
  const [initial] = useState(() => initialForm(violation, devices));
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  // The deadline follows the receipt date until someone types a different one.
  const setReceived = (event) => {
    const received = event.target.value;
    setForm((current) => ({
      ...current,
      received_at: received,
      due_at:
        !current.due_at || current.due_at === transferDeadline(current.received_at)
          ? transferDeadline(received) || current.due_at
          : current.due_at,
    }));
  };

  const urgency = violationUrgency(form);
  const penalty = companyPenalty(form.fine_amount);
  const showWarning = OPEN_STATUSES.includes(form.status) && form.due_at;
  // A saved ticket keeps its driver even when Traccar no longer lists them.
  const hasDriver = Boolean(
    form.driverId || (violation?.driver_id && form.driverId === initial.driverId),
  );

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

  // Vehicle and driver as database ids. An edited ticket keeps the ones it had when the field
  // was not changed, even if Traccar no longer lists that vehicle or driver.
  const resolveIds = async () => {
    const driver = form.driverId ? driversById[form.driverId] : null;
    const vehicleId =
      violation && form.deviceId === initial.deviceId
        ? violation.vehicle_id
        : form.deviceId
          ? await ensureVehicle(devices[form.deviceId], profile)
          : null;
    const driverId =
      violation && form.driverId === initial.driverId
        ? violation.driver_id
        : driver
          ? await ensureDriver(driver, profile)
          : null;
    return { vehicleId, driverId };
  };

  const save = useCatch(async () => {
    setBusy(true);
    try {
      const { vehicleId, driverId } = await resolveIds();
      const nullable = (value) => (value === '' ? null : value);
      const values = {
        vehicle_id: vehicleId,
        driver_id: driverId,
        occurred_at: fromLocalInput(form.occurred_at),
        type: form.type,
        authority: nullable(form.authority.trim()),
        reference_no: nullable(form.reference_no.trim()),
        location: nullable(form.location.trim()),
        fine_amount: nullable(form.fine_amount),
        points: nullable(form.points),
        status: form.status,
        received_at: nullable(form.received_at),
        due_at: nullable(form.due_at),
        charge_driver: form.charge_driver,
        charged_at: form.charge_driver ? nullable(form.charged_at) : null,
        notes: nullable(form.notes.trim()),
      };
      if (file) {
        values.document_path = await uploadFleetFile(profile.org_id, 'safety', file);
      }
      const table = getFleetClient().from('driver_violations');
      unwrap(
        violation
          ? await table.update(values).eq('id', violation.id)
          : await table.insert({ ...values, org_id: profile.org_id, created_by: profile.id }),
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  });

  // The letter naming the driver, with the details from the driver's file.
  const fillLetter = async (win) => {
    const client = getFleetClient();
    const { vehicleId, driverId } = await resolveIds();
    const [driverRow, vehicleRow, organization] = await Promise.all([
      driverId
        ? client
            .from('drivers')
            .select('full_name, national_id, license_number')
            .eq('id', driverId)
            .maybeSingle()
        : null,
      vehicleId
        ? client.from('vehicles').select('plate_number').eq('id', vehicleId).maybeSingle()
        : null,
      client.from('organizations').select('name').eq('id', profile.org_id).maybeSingle(),
    ]);
    const letter = transferLetter(
      {
        violation: { ...form, occurred_at: fromLocalInput(form.occurred_at) },
        driver: driverRow?.data,
        plate: vehicleRow?.data?.plate_number || devices[form.deviceId]?.name,
        organization: organization?.data?.name,
      },
      t,
      formatTime,
    );
    printTransferLetter(win, letter, {
      title: t('fleetLetterTitle'),
      direction: theme.direction,
      fontFamily: theme.typography.fontFamily,
    });
  };

  const printLetter = useCatch(async () => {
    const win = openLetterWindow();
    if (!win) {
      dispatch(messagesActions.push(t('fleetLetterBlocked')));
      return;
    }
    try {
      await fillLetter(win);
    } catch (error) {
      win.close();
      throw error;
    }
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t(violation ? 'fleetViolationEdit' : 'fleetViolationAdd')}</DialogTitle>
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
          <DateTimeField
            label={t('fleetIncidentOccurred')}
            value={form.occurred_at}
            minuteStep={1}
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
          <DateField
            label={t('fleetViolationReceived')}
            value={form.received_at}
            onChange={setReceived}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <DateField
            label={t('fleetViolationDue')}
            value={form.due_at}
            onChange={set('due_at')}
            helperText={form.received_at ? t('fleetViolationDueHelp') : undefined}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {showWarning && (
            <Alert
              className={classes.full}
              severity={
                urgency.level === 'overdue' || urgency.level === 'soon' ? 'warning' : 'info'
              }
            >
              {(urgency.level === 'overdue'
                ? t('fleetViolationWarningOverdue')
                : t('fleetViolationWarning')
              ).replace('{0}', formatTime(form.due_at, 'date'))}
              {penalty != null && ` ${t('fleetViolationPenalty').replace('{0}', money(penalty))}`}
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={form.charge_driver}
                onChange={(event) => setForm({ ...form, charge_driver: event.target.checked })}
              />
            }
            label={t('fleetViolationChargeDriver')}
          />
          {form.charge_driver && (
            <DateField
              label={t('fleetViolationChargedAt')}
              value={form.charged_at}
              onChange={set('charged_at')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
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
      <DialogActions className={classes.actions}>
        <Button
          startIcon={<PrintRoundedIcon />}
          onClick={printLetter}
          disabled={busy || !hasDriver}
        >
          {t('fleetLetterPrint')}
        </Button>
        <div className={classes.actionsEnd}>
          <Button onClick={onClose}>{t('sharedCancel')}</Button>
          <Button variant="contained" onClick={save} disabled={busy || !form.occurred_at}>
            {t('sharedSave')}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default ViolationDialog;

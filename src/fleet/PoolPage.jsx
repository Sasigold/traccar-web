import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import EventSeatRoundedIcon from '@mui/icons-material/EventSeatRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useInvalidateFleet } from '../common/data/fleetQuery';
import { keepOnBackdrop } from '../common/util/formDialog';
import FleetNotice from './components/FleetNotice';
import { useFleetRows } from './stage5Data';

const STATUS_COLOR = {
  requested: 'warning',
  approved: 'success',
  rejected: 'default',
  cancelled: 'default',
  returned: 'default',
};

const localInput = (value) => dayjs(value).format('YYYY-MM-DDTHH:mm');

// The error the database gives, in words (the guard's messages).
const reason = (error, t) => {
  const message = String(error?.message || '');
  if (/test expires/.test(message)) return t('poolTestExpired');
  if (/pool_bookings_no_overlap|exclusion/.test(message) || error?.code === '23P01') {
    return t('poolOverlap');
  }
  return null;
};

const BookingDialog = ({ vehicles, onClose, onSaved }) => {
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(() => ({
    vehicle_id: vehicles[0]?.id || '',
    starts_at: localInput(dayjs().add(1, 'day').hour(8).minute(0)),
    ends_at: localInput(dayjs().add(1, 'day').hour(17).minute(0)),
    destination: '',
    purpose: '',
  }));
  const [problem, setProblem] = useState(null);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useCatch(async () => {
    const { error } = await getFleetClient()
      .from('pool_bookings')
      .insert({
        org_id: profile.org_id,
        vehicle_id: form.vehicle_id,
        starts_at: dayjs(form.starts_at).toISOString(),
        ends_at: dayjs(form.ends_at).toISOString(),
        destination: form.destination.trim() || null,
        purpose: form.purpose.trim() || null,
      });
    if (error) {
      const text = reason(error, t);
      if (text) {
        setProblem(text);
        return;
      }
      throw error;
    }
    onSaved();
  });

  const valid = form.vehicle_id && dayjs(form.ends_at).isAfter(dayjs(form.starts_at));

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t('poolBook')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label={t('sharedDevice')}
            value={form.vehicle_id}
            onChange={set('vehicle_id')}
          >
            {vehicles.map((vehicle) => (
              <MenuItem key={vehicle.id} value={vehicle.id}>
                <span dir="ltr">{vehicle.plate_number}</span>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="datetime-local"
            label={t('reportFrom')}
            value={form.starts_at}
            onChange={set('starts_at')}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
          />
          <TextField
            type="datetime-local"
            label={t('reportTo')}
            value={form.ends_at}
            onChange={set('ends_at')}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
          />
          <TextField
            label={t('poolDestination')}
            value={form.destination}
            onChange={set('destination')}
          />
          <TextField label={t('poolPurpose')} value={form.purpose} onChange={set('purpose')} />
          {problem && (
            <Chip
              color="warning"
              label={problem}
              sx={{ height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!valid}>
          {t('poolSendRequest')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ReturnDialog = ({ booking, onClose, onSaved }) => {
  const t = useTranslation();
  const [odometer, setOdometer] = useState('');
  const [checkOk, setCheckOk] = useState(true);
  const [note, setNote] = useState('');
  const save = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('pool_bookings')
        .update({
          status: 'returned',
          return_odometer_km: odometer === '' ? null : Number(odometer),
          return_check_ok: checkOk,
          return_note: note.trim() || null,
        })
        .eq('id', booking.id),
    );
    onSaved();
  });
  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t('poolReturn')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('poolOdometer')}
            value={odometer}
            onChange={(event) => setOdometer(event.target.value.replace(/[^\d.]/g, ''))}
            slotProps={{ htmlInput: { inputMode: 'decimal', dir: 'ltr' } }}
          />
          <FormControlLabel
            control={
              <Checkbox checked={checkOk} onChange={(event) => setCheckOk(event.target.checked)} />
            }
            label={t('poolCheckOk')}
          />
          <TextField
            label={t('fleetNotes')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('poolReturn')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// OPS-06: pool vehicles: ask for one, a manager approves, and it comes back with its odometer.
const PoolPage = () => {
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('vehicles.read');
  const manage = useFleetPermission('pool.manage');
  const invalidate = useInvalidateFleet();
  const [booking, setBooking] = useState(false);
  const [returning, setReturning] = useState(null);
  const [problem, setProblem] = useState(null);

  const vehicles = useFleetRows('vehicles', {
    select: 'id, plate_number, pool',
    order: 'plate_number',
    enabled: canRead,
  });
  const bookings = useFleetRows('pool_bookings', {
    order: 'starts_at',
    ascending: false,
    enabled: canRead,
  });
  const people = useFleetRows('profiles', { select: 'id, full_name', enabled: canRead });

  const poolVehicles = useMemo(
    () => (vehicles || []).filter((vehicle) => vehicle.pool),
    [vehicles],
  );
  const plateOf = (id) =>
    (vehicles || []).find((vehicle) => vehicle.id === id)?.plate_number || '—';
  const nameOf = (id) => (people || []).find((person) => person.id === id)?.full_name || '—';

  const decide = useCatch(async (row, status) => {
    setProblem(null);
    const { error } = await getFleetClient()
      .from('pool_bookings')
      .update({ status })
      .eq('id', row.id);
    if (error) {
      const text = reason(error, t);
      if (text) {
        setProblem(text);
        return;
      }
      throw error;
    }
    invalidate('pool_bookings');
  });

  const togglePool = useCatch(async (vehicle) => {
    unwrap(
      await getFleetClient().from('vehicles').update({ pool: !vehicle.pool }).eq('id', vehicle.id),
    );
    invalidate('vehicles');
  });

  const refreshed = () => {
    setBooking(false);
    setReturning(null);
    invalidate('pool_bookings');
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'poolTitle']}
      description={t('poolDescription')}
    >
      <FleetNotice permission="vehicles.read" />
      {manage && vehicles && (
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1}
          sx={{ mx: 3, mb: 2 }}
          role="group"
          aria-label={t('poolVehicles')}
        >
          {vehicles.map((vehicle) => (
            <Chip
              key={vehicle.id}
              label={<span dir="ltr">{vehicle.plate_number}</span>}
              color={vehicle.pool ? 'secondary' : 'default'}
              variant={vehicle.pool ? 'filled' : 'outlined'}
              aria-pressed={vehicle.pool}
              aria-label={`${t('poolVehicles')}: ${vehicle.plate_number}`}
              onClick={() => togglePool(vehicle)}
            />
          ))}
        </Stack>
      )}
      {problem && <Chip color="warning" label={problem} sx={{ mx: 3, mb: 2 }} />}
      <DataTable
        toolbar={
          <TableToolbar
            count={bookings?.length || 0}
            actions={
              <Button
                variant="contained"
                size="small"
                disabled={!poolVehicles.length}
                onClick={() => setBooking(true)}
              >
                {t('poolBook')}
              </Button>
            }
          />
        }
        empty={Boolean(bookings) && bookings.length === 0}
        emptyState={{ icon: <EventSeatRoundedIcon />, title: t('poolNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell>{t('poolWho')}</TableCell>
            <TableCell>{t('reportFrom')}</TableCell>
            <TableCell>{t('reportTo')}</TableCell>
            <TableCell>{t('poolDestination')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {(bookings || []).map((row) => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <span dir="ltr">{plateOf(row.vehicle_id)}</span>
              </TableCell>
              <TableCell>{nameOf(row.requested_by)}</TableCell>
              <TableCell>{formatTime(row.starts_at, 'minutes')}</TableCell>
              <TableCell>{formatTime(row.ends_at, 'minutes')}</TableCell>
              <TableCell>{row.destination || '—'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={STATUS_COLOR[row.status]}
                  label={t(`poolStatus${row.status[0].toUpperCase()}${row.status.slice(1)}`)}
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ whiteSpace: 'nowrap' }}>
                  {manage && row.status === 'requested' && (
                    <>
                      <Button size="small" onClick={() => decide(row, 'approved')}>
                        {t('poolApprove')}
                      </Button>
                      <Button size="small" onClick={() => decide(row, 'rejected')}>
                        {t('poolReject')}
                      </Button>
                    </>
                  )}
                  {row.status === 'approved' && (manage || row.requested_by === profile?.id) && (
                    <Button size="small" onClick={() => setReturning(row)}>
                      {t('poolReturn')}
                    </Button>
                  )}
                  {['requested', 'approved'].includes(row.status) &&
                    row.requested_by === profile?.id && (
                      <Button size="small" onClick={() => decide(row, 'cancelled')}>
                        {t('sharedCancel')}
                      </Button>
                    )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {booking && (
        <BookingDialog
          vehicles={poolVehicles}
          onClose={() => setBooking(false)}
          onSaved={refreshed}
        />
      )}
      {returning && (
        <ReturnDialog booking={returning} onClose={() => setReturning(null)} onSaved={refreshed} />
      )}
    </PageLayout>
  );
};

export default PoolPage;

import { useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
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
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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
import { useFleetRows } from './fleetRows';
import PoolWeekCalendar from './components/PoolWeekCalendar';

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

// The actions a booking allows, in the list's row and in the calendar's dialog.
const BookingActions = ({ row, manage, mine, deviceId, decide, onReturn }) => {
  const t = useTranslation();
  return (
    <Stack direction="row" spacing={1} sx={{ whiteSpace: 'nowrap', flexWrap: 'wrap' }}>
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
      {/* OPS-06: the morning check before the keys are handed over, on the booked vehicle. */}
      {row.status === 'approved' && (manage || mine) && deviceId && (
        <Button size="small" component={RouterLink} to={`/fleet/inspection?deviceId=${deviceId}`}>
          {t('poolHandoverCheck')}
        </Button>
      )}
      {row.status === 'approved' && (manage || mine) && (
        <Button size="small" onClick={() => onReturn(row)}>
          {t('poolReturn')}
        </Button>
      )}
      {['requested', 'approved'].includes(row.status) && mine && (
        <Button size="small" onClick={() => decide(row, 'cancelled')}>
          {t('sharedCancel')}
        </Button>
      )}
    </Stack>
  );
};

const statusLabel = (t, status) => t(`poolStatus${status[0].toUpperCase()}${status.slice(1)}`);

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
  const [picked, setPicked] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const setView = (value) => {
    if (!value) return;
    const next = new URLSearchParams(searchParams);
    if (value === 'calendar') next.set('view', 'calendar');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const vehicles = useFleetRows('vehicles', {
    select: 'id, plate_number, pool, traccar_device_id',
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
  const deviceOf = (id) =>
    (vehicles || []).find((vehicle) => vehicle.id === id)?.traccar_device_id || null;
  const actionsOf = (row) => (
    <BookingActions
      row={row}
      manage={manage}
      mine={row.requested_by === profile?.id}
      deviceId={deviceOf(row.vehicle_id)}
      decide={async (target, status) => {
        setPicked(null);
        await decide(target, status);
      }}
      onReturn={(target) => {
        setPicked(null);
        setReturning(target);
      }}
    />
  );

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

  const toolbar = (
    <TableToolbar
      count={bookings?.length || 0}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value) => setView(value)}
            aria-label={t('poolView')}
          >
            <ToggleButton value="list">{t('poolList')}</ToggleButton>
            <ToggleButton value="calendar">{t('poolCalendar')}</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            size="small"
            disabled={!poolVehicles.length}
            onClick={() => setBooking(true)}
          >
            {t('poolBook')}
          </Button>
        </Stack>
      }
    />
  );

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
          sx={{ mx: 3, mb: 2, flexWrap: 'wrap', gap: 1 }}
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
      {view === 'list' ? (
        <DataTable
          toolbar={toolbar}
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
                    label={statusLabel(t, row.status)}
                  />
                </TableCell>
                <TableCell>{actionsOf(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        // The same card as the list's.
        <Paper
          elevation={0}
          sx={(theme) => ({
            borderRadius: `${theme.tokens.radius.xl}px`,
            overflow: 'hidden',
            margin: theme.spacing(0.5, 3, 3),
            [theme.breakpoints.down('md')]: {
              margin: theme.spacing(0, 0, 2),
              borderRadius: 0,
              borderInline: 'none',
            },
          })}
        >
          {toolbar}
          {bookings && (
            <PoolWeekCalendar
              vehicles={poolVehicles}
              bookings={bookings}
              nameOf={nameOf}
              onPick={setPicked}
            />
          )}
        </Paper>
      )}
      {picked && (
        <Dialog open onClose={() => setPicked(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            <span dir="ltr">{plateOf(picked.vehicle_id)}</span> · {nameOf(picked.requested_by)}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              <span>
                {formatTime(picked.starts_at, 'minutes')} – {formatTime(picked.ends_at, 'minutes')}
              </span>
              {picked.destination && <span>{picked.destination}</span>}
              <Chip
                size="small"
                color={STATUS_COLOR[picked.status]}
                label={statusLabel(t, picked.status)}
                sx={{ alignSelf: 'flex-start' }}
              />
              {actionsOf(picked)}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPicked(null)}>{t('sharedClose')}</Button>
          </DialogActions>
        </Dialog>
      )}
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

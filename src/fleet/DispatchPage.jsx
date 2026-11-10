import { useEffect, useMemo, useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import ShareLocationRoundedIcon from '@mui/icons-material/ShareLocationRounded';
import { useLivePositions } from '../common/fleet/usePrivacy';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  JOB_PRIORITIES,
  JOB_STATUSES,
  JOB_TYPES,
  estimateEta,
  isOpenJob,
  trackingExpiry,
  whatsappLink,
} from '../common/fleet/dispatch';
import FleetNotice from './components/FleetNotice';
import {
  camel,
  cleanPayload,
  toNumber,
  useFleetDrivers,
  useFleetRows,
  useFleetVehicles,
} from './stage5Data';
import { DateTimeField } from '../common/components/pickers';
import { keepOnBackdrop } from '../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  action: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

export const jobKey = (group, value) => `fleetJob${group}${camel(value)}`;

const statusColor = {
  planned: 'default',
  assigned: 'info',
  en_route: 'warning',
  arrived: 'warning',
  done: 'success',
  failed: 'error',
  cancelled: 'default',
};

export const JobStatusChip = ({ status }) => {
  const t = useTranslation();
  return <Chip size="small" color={statusColor[status]} label={t(jobKey('Status', status))} />;
};

const localInput = (value) => (value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : '');
const fromInput = (value) => (value ? dayjs(value).toISOString() : null);

const emptyJob = () => ({
  title: '',
  type: 'delivery',
  priority: 'normal',
  status: 'planned',
  poi_id: '',
  customer_name: '',
  customer_phone: '',
  address: '',
  latitude: '',
  longitude: '',
  vehicle_id: '',
  driver_id: '',
  scheduled_at: dayjs().add(1, 'hour').startOf('hour').toISOString(),
  window_end: null,
  notes: '',
});

const jobKeys = [
  'title',
  'type',
  'priority',
  'status',
  'poi_id',
  'customer_name',
  'customer_phone',
  'address',
  'vehicle_id',
  'driver_id',
  'scheduled_at',
  'window_end',
  'notes',
];

const JobDialog = ({ job, pois, vehicles, drivers, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(job);

  const pickPoi = (poiId) => {
    const poi = pois.find((item) => item.id === poiId);
    setForm({
      ...form,
      poi_id: poiId,
      customer_name: form.customer_name || poi?.name || '',
      customer_phone: form.customer_phone || poi?.phone || '',
      address: poi?.address || form.address,
      latitude: poi?.latitude ?? form.latitude,
      longitude: poi?.longitude ?? form.longitude,
    });
  };

  const save = useCatch(async () => {
    const payload = {
      ...cleanPayload(form, jobKeys),
      latitude: toNumber(form.latitude),
      longitude: toNumber(form.longitude),
    };
    const client = getFleetClient();
    const saved = form.id
      ? unwrap(
          await client.from('dispatch_jobs').update(payload).eq('id', form.id).select('*').single(),
        )
      : unwrap(
          await client
            .from('dispatch_jobs')
            .insert({ ...payload, org_id: profile.org_id, created_by: profile.id })
            .select('*')
            .single(),
        );
    onSaved(saved);
  });

  const field = (key, labelKey, props = {}) => (
    <TextField
      label={t(labelKey)}
      value={form[key] ?? ''}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      {...props}
    />
  );
  const select = (key, labelKey, options, labelOf, props = {}) => (
    <TextField
      select
      label={t(labelKey)}
      value={form[key] ?? ''}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      {...props}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {labelOf(option)}
        </MenuItem>
      ))}
    </TextField>
  );
  const dateField = (key, labelKey) => (
    <DateTimeField
      label={t(labelKey)}
      value={localInput(form[key])}
      onChange={(event) => setForm({ ...form, [key]: fromInput(event.target.value) })}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
    />
  );
  const ltr = { slotProps: { htmlInput: { dir: 'ltr' } } };
  const none = { value: '', label: '—' };

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t(form.id ? 'fleetJobEdit' : 'fleetJobAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {field('title', 'fleetJobTitle', { required: true, className: classes.wide })}
          {select(
            'type',
            'sharedType',
            JOB_TYPES.map((value) => ({ value })),
            ({ value }) => t(jobKey('Type', value)),
          )}
          {select(
            'priority',
            'fleetJobPriority',
            JOB_PRIORITIES.map((value) => ({ value })),
            ({ value }) => t(jobKey('Priority', value)),
          )}
          <TextField
            select
            className={classes.wide}
            label={t('fleetPoi')}
            value={form.poi_id ?? ''}
            onChange={(event) => pickPoi(event.target.value)}
          >
            <MenuItem value="">—</MenuItem>
            {pois.map((poi) => (
              <MenuItem key={poi.id} value={poi.id}>
                {poi.name}
              </MenuItem>
            ))}
          </TextField>
          {field('customer_name', 'fleetJobCustomer')}
          {field('customer_phone', 'sharedPhone', ltr)}
          {field('address', 'positionAddress', { className: classes.wide })}
          {field('latitude', 'positionLatitude', { type: 'number', ...ltr })}
          {field('longitude', 'positionLongitude', { type: 'number', ...ltr })}
          {select(
            'vehicle_id',
            'fleetEntityVehicle',
            [
              none,
              ...vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.plate_number })),
            ],
            ({ label }) => label,
          )}
          {select(
            'driver_id',
            'sharedDriver',
            [none, ...drivers.map((driver) => ({ value: driver.id, label: driver.full_name }))],
            ({ label }) => label,
          )}
          {dateField('scheduled_at', 'fleetJobScheduled')}
          {dateField('window_end', 'fleetJobWindowEnd')}
          {form.id &&
            select(
              'status',
              'deviceStatus',
              JOB_STATUSES.map((value) => ({ value })),
              ({ value }) => t(jobKey('Status', value)),
              { className: classes.wide },
            )}
          {field('notes', 'fleetNotes', { multiline: true, minRows: 2, className: classes.wide })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!form.title.trim()}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// A Traccar share link for the job's vehicle, with the ETA, ready to send to the customer.
const TrackingDialog = ({ job, deviceId, eta, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [link, setLink] = useState(() =>
    job.tracking_expires_at && new Date(job.tracking_expires_at) > new Date()
      ? job.tracking_link
      : null,
  );

  const create = useCatch(async () => {
    const expiration = trackingExpiry(job);
    const response = await fetchOrThrow('api/share/device', {
      method: 'POST',
      body: new URLSearchParams({ deviceId, expiration: expiration.toISOString() }),
    });
    const token = await response.text();
    const url = `${document.baseURI}?token=${token}`;
    unwrap(
      await getFleetClient()
        .from('dispatch_jobs')
        .update({ tracking_link: url, tracking_expires_at: expiration.toISOString() })
        .eq('id', job.id),
    );
    setLink(url);
    onSaved();
  });

  const message = link
    ? [
        t('fleetJobTrackingGreeting').replace('{0}', job.customer_name || ''),
        eta ? t('fleetJobTrackingEta').replace('{0}', eta.minutes) : null,
        t('fleetJobTrackingLink').replace('{0}', link),
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t('fleetJobTracking')}</DialogTitle>
      <DialogContent>
        <div className={classes.stack}>
          {!deviceId && <Alert severity="info">{t('fleetJobTrackingNoVehicle')}</Alert>}
          {deviceId && !link && <Alert severity="info">{t('fleetJobTrackingExplain')}</Alert>}
          {link && (
            <TextField
              multiline
              minRows={3}
              label={t('fleetJobTrackingMessage')}
              value={message}
              slotProps={{ input: { readOnly: true } }}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        {link ? (
          <>
            <Button onClick={() => navigator.clipboard?.writeText(message)}>
              {t('sharedCopy')}
            </Button>
            <Button
              variant="contained"
              href={whatsappLink(job.customer_phone, message)}
              target="_blank"
              rel="noopener"
            >
              {t('fleetJobSendWhatsapp')}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={create} disabled={!deviceId}>
            {t('fleetJobTrackingCreate')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const filters = ['today', 'open', 'all'];

// Roadmap stage 5 (4.8): dispatch jobs for vehicles and drivers, live ETA, customer links.
const DispatchPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const canRead = useFleetPermission('dispatch.read');
  const canWrite = useFleetPermission('dispatch.write');
  const positions = useLivePositions();

  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);

  const jobs = useFleetRows('dispatch_jobs', {
    select: '*, pois(name), vehicles(plate_number, traccar_device_id), drivers(full_name)',
    order: 'scheduled_at',
    enabled: canRead,
    reloadKey,
  });
  const pois = useFleetRows('pois', { order: 'name', enabled: canWrite });
  const vehicles = useFleetVehicles(canWrite);
  const drivers = useFleetDrivers(canWrite);

  // LIV-21: "send a job" from the map's nearby vehicles opens a new job at that point.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    if (!canWrite || !latitude || !longitude || !vehicles) return;
    const deviceId = Number(searchParams.get('deviceId'));
    const vehicle = vehicles.find((item) => item.traccar_device_id === deviceId);
    setEditing({ ...emptyJob(), latitude, longitude, vehicle_id: vehicle?.id || '' });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canWrite, vehicles]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const today = dayjs();
    return (jobs || []).filter((job) => {
      if (
        filter === 'today' &&
        !(job.scheduled_at && dayjs(job.scheduled_at).isSame(today, 'day'))
      ) {
        return false;
      }
      if (filter === 'open' && !isOpenJob(job.status)) {
        return false;
      }
      return (
        !keyword ||
        [
          job.title,
          job.customer_name,
          job.address,
          job.pois?.name,
          job.vehicles?.plate_number,
          job.drivers?.full_name,
          String(job.number),
        ].some((value) => value?.toLowerCase().includes(keyword))
      );
    });
  }, [jobs, filter, search]);

  const etaOf = (job) => {
    const deviceId = job.vehicles?.traccar_device_id;
    if (!deviceId || !['assigned', 'en_route'].includes(job.status)) {
      return null;
    }
    return estimateEta(positions[deviceId], {
      latitude: job.latitude,
      longitude: job.longitude,
    });
  };

  const handleExport = async () => {
    const sheets = new Map();
    sheets.set(
      t('fleetDispatchPage'),
      filtered.map((job) => ({
        [t('fleetWorkOrderNumber')]: job.number,
        [t('fleetJobScheduled')]: job.scheduled_at ? formatTime(job.scheduled_at, 'minutes') : '',
        [t('fleetJobTitle')]: job.title,
        [t('fleetJobCustomer')]: job.customer_name || job.pois?.name,
        [t('positionAddress')]: job.address,
        [t('fleetEntityVehicle')]: job.vehicles?.plate_number,
        [t('sharedDriver')]: job.drivers?.full_name,
        [t('deviceStatus')]: t(jobKey('Status', job.status)),
        [t('fleetJobCompleted')]: job.completed_at ? formatTime(job.completed_at, 'minutes') : '',
        [t('fleetJobProofName')]: job.proof_name,
      })),
    );
    await exportExcel(t('fleetDispatchPage'), 'dispatch.xlsx', sheets, theme);
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetDispatchPage']}
      description={t('fleetDispatchPageDescription')}
    >
      <FleetNotice permission="dispatch.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={filtered.length}
            filters={filters.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(`fleetJobFilter${camel(key)}`)}
                color={filter === key ? 'primary' : 'default'}
                variant={filter === key ? 'filled' : 'outlined'}
                onClick={() => setFilter(key)}
              />
            ))}
            exportHandler={canRead ? handleExport : undefined}
            actions={
              canWrite && (
                <Button variant="contained" size="small" onClick={() => setEditing(emptyJob())}>
                  {t('fleetJobAdd')}
                </Button>
              )
            }
          />
        }
        empty={canRead && jobs && filtered.length === 0}
        emptyState={{ icon: <LocalShippingRoundedIcon />, title: t('fleetJobsNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetWorkOrderNumber')}</TableCell>
            <TableCell>{t('fleetJobScheduled')}</TableCell>
            <TableCell>{t('fleetJobTitle')}</TableCell>
            <TableCell>{t('fleetJobCustomer')}</TableCell>
            <TableCell>{t('fleetEntityVehicle')}</TableCell>
            <TableCell>{t('sharedDriver')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('fleetJobEta')}</TableCell>
            {canWrite && <TableCell className={classes.action} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {canRead && !jobs ? (
            <TableShimmer columns={canWrite ? 9 : 8} />
          ) : (
            filtered.map((job) => {
              const eta = etaOf(job);
              return (
                <TableRow key={job.id} hover>
                  <TableCell className={classes.number}>{job.number}</TableCell>
                  <TableCell className={classes.number}>
                    {job.scheduled_at ? formatTime(job.scheduled_at, 'minutes') : ''}
                  </TableCell>
                  <TableCell>{job.title}</TableCell>
                  <TableCell>
                    {job.customer_name || job.pois?.name}
                    {job.address && ` · ${job.address}`}
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{job.vehicles?.plate_number}</span>
                  </TableCell>
                  <TableCell>{job.drivers?.full_name}</TableCell>
                  <TableCell>
                    <JobStatusChip status={job.status} />
                  </TableCell>
                  <TableCell className={classes.number}>
                    {eta
                      ? t('fleetJobEtaValue').replace('{0}', eta.minutes).replace('{1}', eta.km)
                      : ''}
                  </TableCell>
                  {canWrite && (
                    <TableCell className={classes.action}>
                      <Tooltip title={t('fleetJobTracking')}>
                        <IconButton
                          size="small"
                          aria-label={t('fleetJobTracking')}
                          onClick={() => setTracking({ job, eta })}
                        >
                          <ShareLocationRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('sharedEdit')}>
                        <IconButton
                          size="small"
                          aria-label={t('sharedEdit')}
                          onClick={() =>
                            setEditing({
                              ...job,
                              poi_id: job.poi_id || '',
                              vehicle_id: job.vehicle_id || '',
                              driver_id: job.driver_id || '',
                            })
                          }
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </DataTable>
      {editing && (
        <JobDialog
          job={editing}
          pois={pois || []}
          vehicles={(vehicles || []).filter((vehicle) => vehicle.asset_kind !== 'equipment')}
          drivers={drivers || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {tracking && (
        <TrackingDialog
          job={tracking.job}
          eta={tracking.eta}
          deviceId={tracking.job.vehicles?.traccar_device_id}
          onClose={() => setTracking(null)}
          onSaved={reload}
        />
      )}
    </PageLayout>
  );
};

export default DispatchPage;

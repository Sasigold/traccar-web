import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
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
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { useLivePositions } from '../common/fleet/usePrivacy';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { DateRangeField } from '../common/components/pickers';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { circleArea, pairVisits, visitTotals } from '../common/fleet/visits';
import FleetNotice from './components/FleetNotice';
import { camel, cleanPayload, toNumber, useFleetRows } from './stage5Data';
import { keepOnBackdrop } from '../common/util/formDialog';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ImportDialog from './components/ImportDialog';
import { importEntity } from '../common/fleet/bulkImport';
import WazeButton from '../common/components/WazeButton';

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
  date: {
    minWidth: 150,
  },
  range: {
    minWidth: 240,
  },
}));

export const POI_CATEGORIES = ['customer', 'depot', 'supplier', 'fuel', 'garage', 'other'];
export const poiCategoryKey = (category) => `fleetPoiCategory${camel(category)}`;

const emptyPoi = {
  name: '',
  category: 'customer',
  address: '',
  latitude: '',
  longitude: '',
  radius_m: 100,
  contact_name: '',
  phone: '',
  opening_hours: '',
  notes: '',
  active: true,
};

const poiKeys = Object.keys(emptyPoi);

// Creates or moves the Traccar circle geofence of a point, so arrivals become events.
const syncGeofence = async (poi) => {
  const body = {
    name: poi.name,
    description: 'viper fleet POI',
    area: circleArea(poi.latitude, poi.longitude, poi.radius_m),
  };
  if (poi.traccar_geofence_id) {
    const response = await fetchOrThrow(`api/geofences/${poi.traccar_geofence_id}`);
    const current = await response.json();
    await fetchOrThrow(`api/geofences/${poi.traccar_geofence_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, ...body }),
    });
    return poi.traccar_geofence_id;
  }
  const response = await fetchOrThrow('api/geofences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()).id;
};

const PoiDialog = ({ poi, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(poi);
  const [geofence, setGeofence] = useState(true);

  const located = toNumber(form.latitude) !== null && toNumber(form.longitude) !== null;

  const save = useCatch(async () => {
    const payload = {
      ...cleanPayload(form, poiKeys),
      latitude: toNumber(form.latitude),
      longitude: toNumber(form.longitude),
      radius_m: toNumber(form.radius_m) || 100,
    };
    if (geofence && located) {
      payload.traccar_geofence_id = await syncGeofence({
        ...payload,
        traccar_geofence_id: form.traccar_geofence_id,
      });
    }
    const client = getFleetClient();
    const saved = form.id
      ? unwrap(await client.from('pois').update(payload).eq('id', form.id).select('*').single())
      : unwrap(
          await client
            .from('pois')
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
  const ltr = { slotProps: { htmlInput: { dir: 'ltr' } } };

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t(form.id ? 'fleetPoiEdit' : 'fleetPoiAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {field('name', 'sharedName', { required: true })}
          <TextField
            select
            label={t('sharedType')}
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            {POI_CATEGORIES.map((category) => (
              <MenuItem key={category} value={category}>
                {t(poiCategoryKey(category))}
              </MenuItem>
            ))}
          </TextField>
          {field('address', 'positionAddress', { className: classes.wide })}
          {field('latitude', 'positionLatitude', { type: 'number', ...ltr })}
          {field('longitude', 'positionLongitude', { type: 'number', ...ltr })}
          {field('radius_m', 'fleetPoiRadius', { type: 'number', ...ltr })}
          {field('opening_hours', 'fleetPoiHours')}
          {field('contact_name', 'fleetVendorContact')}
          {field('phone', 'sharedPhone', ltr)}
          {field('notes', 'fleetNotes', { multiline: true, minRows: 2, className: classes.wide })}
          <FormControlLabel
            className={classes.wide}
            control={
              <Switch
                checked={geofence && located}
                disabled={!located}
                onChange={(event) => setGeofence(event.target.checked)}
              />
            }
            label={t('fleetPoiGeofence')}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!form.name.trim()}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const views = ['points', 'visits'];

// Roadmap stage 5: points of interest (customers, depots, suppliers) and customer visits.
const PoiPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const canRead = useFleetPermission('poi.read');
  const canWrite = useFleetPermission('poi.write');
  const devices = useSelector((state) => state.devices.items);
  const positions = useLivePositions();

  const [view, setView] = useState('points');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [from, setFrom] = useState(() => dayjs().startOf('day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [visits, setVisits] = useState(null);
  // ADM-13: points from a spreadsheet; each gets its Traccar circle like one added by hand.
  const [importing, setImporting] = useState(false);
  const profile = useFleetProfile();

  const pois = useFleetRows('pois', { order: 'name', enabled: canRead, reloadKey });
  const existingPois = useMemo(
    () => ({ names: new Set((pois || []).map((poi) => String(poi.name).toLowerCase())) }),
    [pois],
  );
  const importPoi = async (values) => {
    const row = importEntity('pois', values);
    const traccarGeofenceId = await syncGeofence(row);
    unwrap(
      await getFleetClient()
        .from('pois')
        .insert({
          ...row,
          traccar_geofence_id: traccarGeofenceId,
          org_id: profile.org_id,
          created_by: profile.id,
        }),
    );
  };

  const poiByGeofence = useMemo(
    () =>
      new Map(
        (pois || [])
          .filter((poi) => poi.traccar_geofence_id)
          .map((poi) => [poi.traccar_geofence_id, poi]),
      ),
    [pois],
  );

  useAsyncTask(
    async ({ signal }) => {
      if (view !== 'visits' || !pois) {
        return;
      }
      setVisits(null);
      const deviceIds = Object.keys(devices);
      if (deviceIds.length === 0 || poiByGeofence.size === 0) {
        setVisits([]);
        return;
      }
      const query = new URLSearchParams({
        from: dayjs(from).startOf('day').toISOString(),
        to: dayjs(to).endOf('day').toISOString(),
      });
      deviceIds.forEach((id) => query.append('deviceId', id));
      query.append('type', 'geofenceEnter');
      query.append('type', 'geofenceExit');
      const response = await fetchOrThrow(`api/reports/events?${query}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      const events = (await response.json()).filter((event) => poiByGeofence.has(event.geofenceId));
      setVisits(pairVisits(events));
    },
    [view, from, to, pois, poiByGeofence, devices],
  );

  const filteredPois = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (pois || []).filter(
      (poi) =>
        !keyword ||
        [poi.name, poi.address, poi.contact_name, poi.phone].some((value) =>
          value?.toLowerCase().includes(keyword),
        ),
    );
  }, [pois, search]);

  const filteredVisits = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (visits || []).filter(
      (visit) =>
        !keyword ||
        [poiByGeofence.get(visit.geofenceId)?.name, devices[visit.deviceId]?.name].some((value) =>
          value?.toLowerCase().includes(keyword),
        ),
    );
  }, [visits, search, poiByGeofence, devices]);

  const totals = useMemo(() => visitTotals(filteredVisits), [filteredVisits]);

  // New point at the current position of a vehicle (e.g. the driver is at the customer now).
  const startFromVehicle = (deviceId) => {
    const position = positions[deviceId];
    setEditing({
      ...emptyPoi,
      latitude: position?.latitude ?? '',
      longitude: position?.longitude ?? '',
      address: position?.address || '',
    });
  };

  const handleExport = async () => {
    const sheets = new Map();
    if (view === 'points') {
      sheets.set(
        t('fleetPoiPage'),
        filteredPois.map((poi) => ({
          [t('sharedName')]: poi.name,
          [t('sharedType')]: t(poiCategoryKey(poi.category)),
          [t('positionAddress')]: poi.address,
          [t('sharedPhone')]: poi.phone,
          [t('fleetPoiVisits')]: totals.get(poi.traccar_geofence_id)?.count || 0,
        })),
      );
    } else {
      sheets.set(
        t('fleetPoiVisits'),
        filteredVisits.map((visit) => ({
          [t('fleetPoi')]: poiByGeofence.get(visit.geofenceId)?.name,
          [t('fleetEntityVehicle')]: devices[visit.deviceId]?.name,
          [t('fleetPoiArrived')]: visit.arrived ? formatTime(visit.arrived, 'minutes') : '',
          [t('fleetPoiLeft')]: visit.left ? formatTime(visit.left, 'minutes') : '',
          [t('reportDuration')]: visit.minutes ?? '',
        })),
      );
    }
    await exportExcel(t('fleetPoiPage'), 'poi.xlsx', sheets, theme);
  };

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(`fleetPoiView${camel(key)}`)}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => setView(key)}
    />
  ));

  const deviceList = Object.values(devices).filter((device) => positions[device.id]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetPoiPage']}
      description={t('fleetPoiPageDescription')}
    >
      <FleetNotice permission="poi.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={view === 'points' ? filteredPois.length : filteredVisits.length}
            filters={viewChips}
            exportHandler={canRead ? handleExport : undefined}
            actions={
              <>
                {view === 'visits' && (
                  <>
                    <DateRangeField
                      size="small"
                      label={t('reportPeriod')}
                      from={from}
                      to={to}
                      onChange={(start, end) => {
                        setFrom(start);
                        setTo(end);
                      }}
                      clearable={false}
                      className={classes.range}
                    />
                  </>
                )}
                {view === 'points' && canWrite && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileRoundedIcon />}
                    onClick={() => setImporting(true)}
                  >
                    {t('importFromExcel')}
                  </Button>
                )}
                {view === 'points' && canWrite && deviceList.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label={t('fleetPoiFromVehicle')}
                    value=""
                    onChange={(event) => startFromVehicle(event.target.value)}
                    className={classes.date}
                  >
                    {deviceList.map((device) => (
                      <MenuItem key={device.id} value={device.id}>
                        {device.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {view === 'points' && canWrite && (
                  <Button variant="contained" size="small" onClick={() => setEditing(emptyPoi)}>
                    {t('fleetPoiAdd')}
                  </Button>
                )}
              </>
            }
          />
        }
        empty={
          canRead &&
          (view === 'points'
            ? pois && filteredPois.length === 0
            : visits && filteredVisits.length === 0)
        }
        emptyState={{
          icon: <PlaceRoundedIcon />,
          title: t(view === 'points' ? 'fleetPoiNone' : 'fleetPoiVisitsNone'),
        }}
      >
        {view === 'points' ? (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('sharedType')}</TableCell>
                <TableCell>{t('positionAddress')}</TableCell>
                <TableCell>{t('fleetVendorContact')}</TableCell>
                <TableCell>{t('sharedGeofence')}</TableCell>
                {canWrite && <TableCell className={classes.action} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {canRead && !pois ? (
                <TableShimmer columns={canWrite ? 6 : 5} />
              ) : (
                filteredPois.map((poi) => (
                  <TableRow key={poi.id} hover>
                    <TableCell>{poi.name}</TableCell>
                    <TableCell>{t(poiCategoryKey(poi.category))}</TableCell>
                    <TableCell>
                      {poi.address}
                      <WazeButton place={poi} label={poi.name} />
                    </TableCell>
                    <TableCell>
                      {poi.contact_name}
                      {poi.phone && (
                        <>
                          {' · '}
                          <span dir="ltr">{poi.phone}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>{t(poi.traccar_geofence_id ? 'sharedYes' : 'sharedNo')}</TableCell>
                    {canWrite && (
                      <TableCell className={classes.action}>
                        <Tooltip title={t('sharedEdit')}>
                          <IconButton
                            size="small"
                            aria-label={t('sharedEdit')}
                            onClick={() => setEditing(poi)}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        ) : (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetPoi')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('fleetPoiArrived')}</TableCell>
                <TableCell>{t('fleetPoiLeft')}</TableCell>
                <TableCell>{t('fleetPoiMinutes')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {canRead && !visits ? (
                <TableShimmer columns={5} />
              ) : (
                filteredVisits.map((visit) => (
                  <TableRow
                    key={`${visit.deviceId}-${visit.geofenceId}-${visit.arrived}-${visit.left}`}
                    hover
                  >
                    <TableCell>{poiByGeofence.get(visit.geofenceId)?.name}</TableCell>
                    <TableCell>{devices[visit.deviceId]?.name}</TableCell>
                    <TableCell className={classes.number}>
                      {visit.arrived ? formatTime(visit.arrived, 'minutes') : '—'}
                    </TableCell>
                    <TableCell className={classes.number}>
                      {visit.left ? formatTime(visit.left, 'minutes') : t('fleetPoiStillThere')}
                    </TableCell>
                    <TableCell className={classes.number}>{visit.minutes ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        )}
      </DataTable>
      {editing && (
        <PoiDialog
          poi={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {importing && (
        <ImportDialog
          kind="pois"
          existing={existingPois}
          save={importPoi}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}
    </PageLayout>
  );
};

export default PoiPage;

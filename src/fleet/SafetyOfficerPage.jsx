import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import FileInput from '../common/components/FileInput';
import { DateField } from '../common/components/pickers';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { formatDays } from '../common/util/plural';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  DEFAULT_OFFICER_RULES,
  licenseCheckMonths,
  quarterOf,
  quarterSummary,
  safetyTasks,
} from '../common/fleet/safetyOfficer';
import FleetNotice from './components/FleetNotice';
import SafetyRecordDialog from './components/SafetyRecordDialog';
import { openLetterWindow } from './components/printTransferLetter';
import printQuarterReport from './components/printQuarterReport';
import { ensureDriver, ensureVehicle, openFleetFile, uploadFleetFile } from './fleetData';

const useStyles = makeStyles()((theme) => ({
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  rules: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
}));

const FILTERS = ['all', 'overdue', 'soon'];
const STATUS_COLOR = { overdue: 'error', soon: 'warning', ok: 'default' };
const RULE_KEYS = Object.keys(DEFAULT_OFFICER_RULES);
const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());
const yearAgo = () => new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();

// The frequencies of the work plan, per organization.
const RulesDialog = ({ rules, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [values, setValues] = useState(rules);

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient().from('org_safety_settings').upsert(
        {
          org_id: profile.org_id,
          officer_rules: values,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' },
      ),
    );
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('safetyOfficerRules')}</DialogTitle>
      <DialogContent>
        <div className={classes.rules}>
          {RULE_KEYS.map((key) => (
            <TextField
              key={key}
              type="number"
              size="small"
              label={t(`safetyRule${capital(key)}`)}
              value={values[key]}
              onChange={(event) => setValues({ ...values, [key]: Number(event.target.value) })}
              slotProps={{ htmlInput: { dir: 'ltr', min: 1 } }}
            />
          ))}
          <Alert severity="info" className={classes.wide}>
            {t('safetyOfficerRulesNote')}
          </Alert>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Which drivers are professional (quarterly meeting, licence check every six months).
const ProfessionalsDialog = ({ drivers, onClose, onSaved }) => {
  const t = useTranslation();
  const [values, setValues] = useState(() =>
    Object.fromEntries(drivers.map((driver) => [driver.id, Boolean(driver.is_professional)])),
  );

  const save = useCatch(async () => {
    const client = getFleetClient();
    const changed = drivers.filter(
      (driver) => values[driver.id] !== Boolean(driver.is_professional),
    );
    for (const driver of changed) {
      unwrap(
        await client.rpc('safety_set_professional', {
          p_driver: driver.id,
          p_value: values[driver.id],
        }),
      );
    }
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('safetyProfessionals')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {t('safetyProfessionalsHelp')}
        </Typography>
        {drivers.map((driver) => (
          <div key={driver.id}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values[driver.id]}
                  onChange={(event) => setValues({ ...values, [driver.id]: event.target.checked })}
                />
              }
              label={driver.full_name || '—'}
            />
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// A tachograph download: the vehicle unit or a driver's card, with the file.
const TachographDialog = ({ initial, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const [form, setForm] = useState(() => ({
    kind: initial?.kind || 'vehicle',
    deviceId: initial?.deviceId ? String(initial.deviceId) : '',
    driverId: initial?.driverId ? String(initial.driverId) : '',
    downloaded_at: new Date().toISOString().slice(0, 10),
    notes: '',
  }));
  const [file, setFile] = useState(null);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useCatch(async () => {
    const driver = Object.values(drivers).find((item) => String(item.id) === form.driverId);
    unwrap(
      await getFleetClient()
        .from('tachograph_downloads')
        .insert({
          org_id: profile.org_id,
          kind: form.kind,
          vehicle_id:
            form.kind === 'vehicle' ? await ensureVehicle(devices[form.deviceId], profile) : null,
          driver_id: form.kind === 'card' ? await ensureDriver(driver, profile) : null,
          downloaded_at: form.downloaded_at,
          notes: form.notes.trim() || null,
          document_path: file ? await uploadFleetFile(profile.org_id, 'safety', file) : null,
          created_by: profile.id,
        }),
    );
    onSaved();
  });

  const valid = form.downloaded_at && (form.kind === 'vehicle' ? form.deviceId : form.driverId);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('safetyTachographAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField select label={t('sharedType')} value={form.kind} onChange={set('kind')}>
            <MenuItem value="vehicle">{t('safetyTachographVehicle')}</MenuItem>
            <MenuItem value="card">{t('safetyTachographCard')}</MenuItem>
          </TextField>
          {form.kind === 'vehicle' ? (
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
          ) : (
            <TextField
              select
              label={t('sharedDriver')}
              value={form.driverId}
              onChange={set('driverId')}
            >
              {Object.values(drivers)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((driver) => (
                  <MenuItem key={driver.id} value={String(driver.id)}>
                    {driver.name}
                  </MenuItem>
                ))}
            </TextField>
          )}
          <DateField
            label={t('safetyTachographDate')}
            value={form.downloaded_at}
            onChange={set('downloaded_at')}
          />
          <FileInput placeholder={t('safetyTachographFile')} value={file} onChange={setFile} />
          <TextField label={t('fleetNotes')} value={form.notes} onChange={set('notes')} />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!valid}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// A procedure, form or template in the library, with its file.
const ProcedureDialog = ({ onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(() => ({
    title: '',
    category: 'procedure',
    version: '',
    published_at: new Date().toISOString().slice(0, 10),
  }));
  const [file, setFile] = useState(null);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('safety_procedures')
        .insert({
          org_id: profile.org_id,
          title: form.title.trim(),
          category: form.category,
          version: form.version.trim() || null,
          published_at: form.published_at || null,
          document_path: file ? await uploadFleetFile(profile.org_id, 'procedures', file) : null,
          created_by: profile.id,
        }),
    );
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('safetyProcedureAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField label={t('sharedName')} value={form.title} onChange={set('title')} />
          <TextField
            select
            label={t('sharedType')}
            value={form.category}
            onChange={set('category')}
          >
            {['procedure', 'form', 'template', 'regulation'].map((category) => (
              <MenuItem key={category} value={category}>
                {t(`safetyProcedure${capital(category)}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('safetyProcedureVersion')}
            value={form.version}
            onChange={set('version')}
          />
          <DateField
            label={t('safetyProcedureDate')}
            value={form.published_at}
            onChange={set('published_at')}
          />
          <FileInput placeholder={t('safetyProcedureFile')} value={file} onChange={setFile} />
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

// The procedures library: open a file, or add one (safety.write).
const ProceduresDialog = ({ procedures, canWrite, onAdd, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('safetyProcedures')}</DialogTitle>
      <DialogContent>
        {procedures.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            {t('safetyProceduresNone')}
          </Typography>
        )}
        {procedures.map((procedure) => (
          <div key={procedure.id} className={classes.line}>
            <Typography variant="body2">
              {procedure.title}
              {' · '}
              {t(`safetyProcedure${capital(procedure.category)}`)}
              {procedure.version && ` · ${procedure.version}`}
              {procedure.published_at && ` · ${formatTime(procedure.published_at, 'date')}`}
            </Typography>
            {procedure.document_path && (
              <Button size="small" onClick={() => openFleetFile(procedure.document_path)}>
                {t('safetyProcedureOpen')}
              </Button>
            )}
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        {canWrite && <Button onClick={onAdd}>{t('safetyProcedureAdd')}</Button>}
        <Button onClick={onClose}>{t('a11yClose')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// Fleet → Safety officer (ISR-04): every duty of regulation 585 with its due date, the
// quarterly report to the owner, tachograph downloads and the procedures library.
const SafetyOfficerPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('safety.read');
  const canWrite = useFleetPermission('safety.write');
  const devices = useSelector((state) => state.devices.items);
  const traccarDrivers = useSelector((state) => state.drivers.items);
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [records, setRecords] = useState(null);
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    const since = yearAgo();
    const [
      settings,
      drivers,
      reviews,
      checks,
      incidents,
      tachographs,
      trainings,
      violations,
      procedures,
    ] = await Promise.all([
      client.from('org_safety_settings').select('officer_rules').maybeSingle(),
      client.from('drivers').select('id, full_name, status, is_professional, traccar_driver_id'),
      client
        .from('safety_reviews')
        .select('id, driver_id, kind, held_at, driver_signed_at, incident_id')
        .gte('held_at', since.slice(0, 10)),
      client.from('driver_license_checks').select('driver_id, checked_at, next_check_at'),
      client
        .from('incidents')
        .select('id, number, type, occurred_at, driver_id')
        .gte('occurred_at', since),
      client
        .from('tachograph_downloads')
        .select('*, vehicles(plate_number, traccar_device_id), drivers(full_name)')
        .order('downloaded_at', { ascending: false }),
      client.from('driver_trainings').select('held_at').gte('held_at', since.slice(0, 10)),
      client.from('driver_violations').select('occurred_at').gte('occurred_at', since),
      client.from('safety_procedures').select('*').order('title'),
    ]);
    setRecords({
      rules: { ...DEFAULT_OFFICER_RULES, ...(unwrap(settings)?.officer_rules || {}) },
      drivers: unwrap(drivers) || [],
      reviews: unwrap(reviews) || [],
      checks: unwrap(checks) || [],
      incidents: unwrap(incidents) || [],
      tachographs: unwrap(tachographs) || [],
      trainings: unwrap(trainings) || [],
      violations: unwrap(violations) || [],
      procedures: unwrap(procedures) || [],
    });
  }, [canRead, reloadKey]);

  const tasks = useMemo(
    () =>
      records &&
      safetyTasks(
        {
          drivers: records.drivers,
          reviews: records.reviews,
          checks: records.checks,
          incidents: records.incidents,
          investigations: records.reviews.filter((row) => row.kind === 'investigation'),
          tachographs: records.tachographs,
        },
        records.rules,
      ),
    [records],
  );

  const driversById = useMemo(
    () => Object.fromEntries((records?.drivers || []).map((driver) => [driver.id, driver])),
    [records],
  );
  const traccarDriver = (driverId) => {
    const row = driversById[driverId];
    return row && Object.values(traccarDrivers).find((item) => item.id === row.traccar_driver_id);
  };
  const tachographVehicle = (vehicleId) =>
    records?.tachographs.find((row) => row.vehicle_id === vehicleId)?.vehicles;

  const incidentLabel = (incident) =>
    `${incident.number ? `#${incident.number} · ` : ''}${formatTime(incident.occurred_at, 'date')}`;
  const accidents = (records?.incidents || [])
    .filter((incident) => incident.type === 'accident')
    .map((incident) => ({ id: incident.id, label: incidentLabel(incident) }));

  const subject = (task) => {
    if (task.kind === 'tachograph') {
      if (task.tachographKind === 'card') {
        return driversById[task.driverId]?.full_name || '—';
      }
      const vehicle = tachographVehicle(task.vehicleId);
      return devices[vehicle?.traccar_device_id]?.name || vehicle?.plate_number || '—';
    }
    if (task.kind === 'investigation') {
      const incident = records.incidents.find((row) => row.id === task.incidentId);
      return (
        <Link component={RouterLink} to={`/fleet/incident/${task.incidentId}`}>
          {incident ? incidentLabel(incident) : t('fleetIncidentsPage')}
        </Link>
      );
    }
    const driver = driversById[task.driverId];
    return driver?.traccar_driver_id != null ? (
      <Link component={RouterLink} to={`/fleet/driver-file/${driver.traccar_driver_id}`}>
        {driver.full_name}
      </Link>
    ) : (
      driver?.full_name || '—'
    );
  };

  const statusLabel = (task) =>
    task.status === 'overdue'
      ? `${t('fleetViolationOverdue')} ${formatDays(task.days, t)}`
      : task.days === 0
        ? t('fleetViolationDueToday')
        : t('fleetViolationDaysLeft').replace('{0}', formatDays(task.days, t));

  const act = (task) => {
    if (task.kind === 'meeting') {
      setDialog({ type: 'review', driver: traccarDriver(task.driverId), reviewKind: 'periodic' });
    } else if (task.kind === 'licenseCheck') {
      setDialog({ type: 'check', driver: traccarDriver(task.driverId), dbDriverId: task.driverId });
    } else if (task.kind === 'investigation') {
      setDialog({
        type: 'review',
        driver: traccarDriver(task.driverId),
        reviewKind: 'investigation',
        incidentId: task.incidentId,
      });
    } else {
      const vehicle = tachographVehicle(task.vehicleId);
      setDialog({
        type: 'tachograph',
        initial: {
          kind: task.tachographKind,
          deviceId: vehicle?.traccar_device_id,
          driverId: driversById[task.driverId]?.traccar_driver_id,
        },
      });
    }
  };

  const printReport = useCatch(async () => {
    const win = openLetterWindow();
    if (!win) {
      return;
    }
    try {
      const quarter = quarterOf(new Date());
      const summary = quarterSummary(records, tasks, quarter);
      const organization = unwrap(
        await getFleetClient()
          .from('organizations')
          .select('name')
          .eq('id', profile.org_id)
          .maybeSingle(),
      );
      const rows = [
        'meetings',
        'meetingsSigned',
        'licenseChecks',
        'trainings',
        'accidents',
        'investigations',
        'violations',
        'tachographs',
        'overdue',
        'soon',
      ].map((key) => [t(`safetyQuarter${capital(key)}`), summary[key]]);
      printQuarterReport(
        win,
        {
          organization: organization?.name || '',
          date: formatTime(new Date(), 'date'),
          title: t('safetyQuarterTitle')
            .replace('{0}', quarter.quarter)
            .replace('{1}', quarter.year),
          period: `${formatTime(quarter.from, 'date')} – ${formatTime(quarter.to, 'date')}`,
          summaryTitle: t('safetyQuarterSummary'),
          summaryHeaders: [t('sharedType'), t('safetyQuarterCount')],
          summary: rows,
          tasksTitle: t('safetyQuarterOpen'),
          tasksHeaders: [
            t('sharedType'),
            t('safetyTaskSubject'),
            t('safetyTaskDue'),
            t('deviceStatus'),
          ],
          tasks: tasks
            .filter((task) => task.status !== 'ok')
            .map((task) => [
              t(`safetyTask${capital(task.kind)}`),
              typeof subject(task) === 'string'
                ? subject(task)
                : driversById[task.driverId]?.full_name || t('fleetIncidentsPage'),
              formatTime(task.dueAt, 'date'),
              statusLabel(task),
            ]),
          noTasks: t('safetyQuarterNoOpen'),
          notesTitle: t('safetyQuarterNotes'),
          signatures: [t('safetyQuarterSignOfficer'), t('safetyQuarterSignOwner')],
        },
        {
          title: t('safetyQuarterTitle')
            .replace('{0}', quarter.quarter)
            .replace('{1}', quarter.year),
          direction: theme.direction,
          fontFamily: theme.typography.fontFamily,
        },
      );
    } catch (error) {
      win.close();
      throw error;
    }
  });

  const counts = useMemo(
    () => ({
      all: tasks?.length || 0,
      overdue: tasks?.filter((task) => task.status === 'overdue').length || 0,
      soon: tasks?.filter((task) => task.status === 'soon').length || 0,
    }),
    [tasks],
  );
  const shown = tasks?.filter((task) => filter === 'all' || task.status === filter);
  const done = () => {
    setDialog(null);
    reload();
  };

  const filters = FILTERS.map((key) => (
    <Chip
      key={key}
      size="small"
      label={`${t(`safetyFilter${capital(key)}`)} · ${counts[key]}`}
      color={filter === key ? 'primary' : 'default'}
      variant={filter === key ? 'filled' : 'outlined'}
      onClick={() => setFilter(key)}
    />
  ));

  const actions = records && (
    <>
      <Button size="small" startIcon={<PrintRoundedIcon />} onClick={printReport}>
        {t('safetyQuarterPrint')}
      </Button>
      <Button
        size="small"
        startIcon={<MenuBookRoundedIcon />}
        onClick={() => setDialog({ type: 'procedures' })}
      >
        {t('safetyProcedures')}
      </Button>
      {canWrite && (
        <>
          <Button
            size="small"
            startIcon={<GroupsRoundedIcon />}
            onClick={() => setDialog({ type: 'professionals' })}
          >
            {t('safetyProfessionals')}
          </Button>
          <Button
            size="small"
            startIcon={<TuneRoundedIcon />}
            onClick={() => setDialog({ type: 'rules' })}
          >
            {t('safetyOfficerRules')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => setDialog({ type: 'tachograph' })}
          >
            {t('safetyTachographAdd')}
          </Button>
        </>
      )}
    </>
  );

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetSafetyPage', 'safetyOfficerPage']}
      description={t('safetyOfficerPageDescription')}
    >
      <FleetNotice permission="safety.read" />
      {records && !records.drivers.some((driver) => driver.is_professional) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('safetyNoProfessionals')}
        </Alert>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            count={shown ? shown.length : undefined}
            filters={filters}
            actions={actions}
          />
        }
        empty={shown != null && shown.length === 0}
        emptyState={{ icon: <AssignmentTurnedInRoundedIcon />, title: t('safetyNoTasks') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('safetyTaskSubject')}</TableCell>
            <TableCell>{t('safetyTaskLast')}</TableCell>
            <TableCell>{t('safetyTaskDue')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            {canWrite && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {!records && canRead && <TableShimmer columns={canWrite ? 6 : 5} />}
          {shown?.map((task) => (
            <TableRow
              key={`${task.kind}-${task.driverId || task.incidentId || task.vehicleId}-${task.tachographKind || ''}`}
              hover
            >
              <TableCell>
                {t(`safetyTask${capital(task.kind)}`)}
                {task.kind === 'tachograph' &&
                  ` · ${t(`safetyTachograph${capital(task.tachographKind)}`)}`}
                {task.unsigned && (
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mx: 0.5 }}
                    label={t('safetyUnsigned')}
                  />
                )}
              </TableCell>
              <TableCell>{subject(task)}</TableCell>
              <TableCell className={classes.number}>
                {task.lastAt ? formatTime(task.lastAt, 'date') : t('safetyNever')}
              </TableCell>
              <TableCell className={classes.number}>{formatTime(task.dueAt, 'date')}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={STATUS_COLOR[task.status]}
                  variant={task.status === 'ok' ? 'outlined' : 'filled'}
                  label={statusLabel(task)}
                />
              </TableCell>
              {canWrite && (
                <TableCell>
                  <Button size="small" onClick={() => act(task)}>
                    {t(`safetyAct${capital(task.kind)}`)}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>

      {(dialog?.type === 'review' || dialog?.type === 'check') && (
        <SafetyRecordDialog
          kind={dialog.type}
          driver={dialog.driver}
          reviewKind={dialog.reviewKind}
          incidentId={dialog.incidentId}
          incidents={accidents}
          checkMonths={
            dialog.dbDriverId
              ? licenseCheckMonths(driversById[dialog.dbDriverId], records.rules)
              : records.rules.licenseCheckMonthsProfessional
          }
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}
      {dialog?.type === 'tachograph' && (
        <TachographDialog initial={dialog.initial} onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.type === 'procedures' && (
        <ProceduresDialog
          procedures={records.procedures}
          canWrite={canWrite}
          onAdd={() => setDialog({ type: 'procedure' })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'procedure' && (
        <ProcedureDialog onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.type === 'rules' && (
        <RulesDialog rules={records.rules} onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.type === 'professionals' && (
        <ProfessionalsDialog
          drivers={records.drivers.filter((driver) => driver.status !== 'inactive')}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}
    </PageLayout>
  );
};

export default SafetyOfficerPage;

import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatGrouped, formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  DEFAULT_HOURS_RULES,
  DEFAULT_SCORE_WEIGHTS,
  drivingHours,
  scoreDrivers,
} from '../common/fleet/safety';
import FleetNotice from './components/FleetNotice';
import ExpiryBadge from './components/ExpiryBadge';
import ViolationDialog, { violationKey } from './components/ViolationDialog';
import SafetyRecordDialog from './components/SafetyRecordDialog';
import { money } from './fleetData';
import { assignmentResolver, loadAssignments, loadDriving, loadSafetySettings } from './safetyData';
import { formatDays } from '../common/util/plural';
import { violationUrgency, violationsByDriver } from '../common/fleet/violations';

const useStyles = makeStyles()((theme) => ({
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  settings: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  heading: {
    gridColumn: '1 / -1',
    fontWeight: 700,
  },
  period: {
    minWidth: 140,
  },
}));

const views = ['scores', 'hours', 'compliance', 'violations', 'byDriver'];
const recordViews = ['compliance', 'violations', 'byDriver'];
const periods = [7, 30, 90];
const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());
const scoreColor = (score) =>
  score == null ? 'default' : score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
const hoursText = (minutes) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

// Score weights and driving / rest limits for the organization.
const SettingsDialog = ({ settings, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [weights, setWeights] = useState(settings.weights);
  const [rules, setRules] = useState(settings.rules);

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient().from('org_safety_settings').upsert(
        {
          org_id: profile.org_id,
          score_weights: weights,
          hours_rules: rules,
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
      <DialogTitle>{t('fleetSafetySettings')}</DialogTitle>
      <DialogContent>
        <div className={classes.settings}>
          <Typography className={classes.heading}>{t('fleetSafetyWeights')}</Typography>
          {Object.keys(DEFAULT_SCORE_WEIGHTS).map((key) => (
            <TextField
              key={key}
              type="number"
              size="small"
              label={t(`fleetSafetyEvent${capital(key)}`)}
              value={weights[key]}
              onChange={(event) => setWeights({ ...weights, [key]: Number(event.target.value) })}
              slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }}
            />
          ))}
          <Typography className={classes.heading}>{t('fleetSafetyRules')}</Typography>
          {Object.keys(DEFAULT_HOURS_RULES).map((key) => (
            <TextField
              key={key}
              type="number"
              size="small"
              label={t(`fleetSafetyRule${capital(key)}`)}
              value={rules[key]}
              onChange={(event) => setRules({ ...rules, [key]: Number(event.target.value) })}
              slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }}
            />
          ))}
          <Alert severity="info" className={classes.heading}>
            {t('fleetSafetyLegalNote')}
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

// Roadmap stage 4: driver scores, driving hours, compliance and violations.
const SafetyPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const canRead = useFleetPermission('safety.read');
  const canWrite = useFleetPermission('safety.write');
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);

  const [searchParams] = useSearchParams();
  const [view, setView] = useState(() =>
    views.includes(searchParams.get('view')) ? searchParams.get('view') : 'scores',
  );
  const [days, setDays] = useState(30);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [settings, setSettings] = useState(null);
  const [driving, setDriving] = useState(null);
  const [records, setRecords] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(null);

  const driversById = useMemo(
    () => Object.fromEntries(Object.values(drivers).map((driver) => [driver.id, driver])),
    [drivers],
  );
  const deviceIds = Object.keys(devices).join(',');

  useAsyncTask(async () => {
    void reloadKey;
    if (canRead) {
      setSettings(await loadSafetySettings());
    }
  }, [canRead, reloadKey]);

  // Trips and events from Traccar for the scores and hours views.
  useAsyncTask(
    async ({ signal }) => {
      if (!canRead || (view !== 'scores' && view !== 'hours')) {
        return;
      }
      setDriving(null);
      const to = new Date();
      const from = new Date(to - days * 86400000);
      const ids = deviceIds ? deviceIds.split(',') : [];
      const [data, assignments] = await Promise.all([
        loadDriving(ids, from, to, signal),
        loadAssignments(),
      ]);
      setDriving({ ...data, resolve: assignmentResolver(assignments, driversById) });
    },
    [canRead, view, days, deviceIds, driversById],
  );

  // Database records for compliance and violations.
  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !recordViews.includes(view)) {
      return;
    }
    setRecords(null);
    const client = getFleetClient();
    const [violations, checks, trainings, driverRows] = await Promise.all([
      client
        .from('driver_violations')
        .select(
          '*, drivers(full_name, traccar_driver_id), vehicles(plate_number, traccar_device_id)',
        )
        .order('occurred_at', { ascending: false })
        .limit(500),
      client
        .from('driver_license_checks')
        .select('driver_id, checked_at, next_check_at, license_valid')
        .order('checked_at', { ascending: false }),
      client
        .from('driver_trainings')
        .select('driver_id, held_at, topic')
        .order('held_at', { ascending: false }),
      client.from('drivers').select('id, traccar_driver_id, full_name, status'),
    ]);
    setRecords({
      violations: unwrap(violations) || [],
      checks: unwrap(checks) || [],
      trainings: unwrap(trainings) || [],
      drivers: unwrap(driverRows) || [],
    });
  }, [canRead, view, reloadKey]);

  const scores = useMemo(() => {
    if (!driving || !settings) return null;
    return scoreDrivers(driving.trips, driving.events, {
      weights: settings.weights,
      fallbackDriver: driving.resolve,
    });
  }, [driving, settings]);

  const hours = useMemo(() => {
    if (!driving || !settings) return null;
    const byDriver = new Map();
    driving.trips.forEach((trip) => {
      const key = trip.driverUniqueId || driving.resolve(trip.deviceId, Date.parse(trip.startTime));
      if (key) {
        byDriver.set(key, [...(byDriver.get(key) || []), trip]);
      }
    });
    return [...byDriver.entries()]
      .map(([driver, trips]) => ({ driver, ...drivingHours(trips, settings.rules) }))
      .sort((a, b) => b.violations.length - a.violations.length || b.totalMinutes - a.totalMinutes);
  }, [driving, settings]);

  // One line per active driver: last license check, next one due, last training, open violations.
  const compliance = useMemo(() => {
    if (!records) return null;
    return records.drivers
      .filter((driver) => driver.status !== 'inactive')
      .map((driver) => {
        const check = records.checks.find((row) => row.driver_id === driver.id);
        const training = records.trainings.find((row) => row.driver_id === driver.id);
        const open = records.violations.filter(
          (row) =>
            row.driver_id === driver.id && !['paid', 'closed', 'transferred'].includes(row.status),
        );
        return { driver, check, training, open: open.length };
      })
      .sort((a, b) =>
        (a.check?.next_check_at || '0000') < (b.check?.next_check_at || '0000') ? -1 : 1,
      );
  }, [records]);

  const byDriver = useMemo(() => records && violationsByDriver(records.violations), [records]);

  // Countdown to the day the driver must be named (or the ticket paid).
  const deadlineChip = (row) => {
    const { level, days } = violationUrgency(row);
    if (level === 'done' || level === 'none') {
      return null;
    }
    const label =
      level === 'overdue'
        ? `${t('fleetViolationOverdue')} ${formatDays(days, t)}`
        : days === 0
          ? t('fleetViolationDueToday')
          : t('fleetViolationDaysLeft').replace('{0}', formatDays(days, t));
    return (
      <Tooltip title={`${t('fleetViolationDue')} ${formatTime(row.due_at, 'date')}`}>
        <Chip
          size="small"
          color={level === 'overdue' ? 'error' : level === 'soon' ? 'warning' : 'default'}
          variant={level === 'ok' ? 'outlined' : 'filled'}
          sx={{ mx: 0.5 }}
          label={label}
        />
      </Tooltip>
    );
  };

  const driverName = (uniqueId) => drivers[uniqueId]?.name || uniqueId;
  const driverLink = (uniqueId) =>
    drivers[uniqueId] && `/fleet/driver-file/${drivers[uniqueId].id}`;

  const handleExport = async () => {
    let data = [];
    if (view === 'scores') {
      data = scores.map((row) => ({
        [t('sharedDriver')]: driverName(row.driver),
        [t('fleetSafetyScore')]: row.score ?? '',
        [t('fleetSafetyKm')]: row.km,
        [t('fleetSafetyEvents')]: row.events,
      }));
    } else if (view === 'hours') {
      data = hours.map((row) => ({
        [t('sharedDriver')]: driverName(row.driver),
        [t('fleetSafetyDrivingHours')]: hoursText(row.totalMinutes),
        [t('fleetSafetyViolations')]: row.violations.length,
      }));
    } else if (view === 'violations') {
      data = records.violations.map((row) => ({
        [t('fleetIncidentOccurred')]: formatTime(row.occurred_at, 'minutes'),
        [t('sharedDriver')]: row.drivers?.full_name,
        [t('fleetEntityVehicle')]: row.vehicles?.plate_number,
        [t('sharedType')]: t(violationKey('Type', row.type)),
        [t('fleetViolationFine')]: row.fine_amount == null ? '' : Number(row.fine_amount),
        [t('fleetViolationPoints')]: row.points ?? '',
        [t('deviceStatus')]: t(violationKey('Status', row.status)),
        [t('fleetViolationReceived')]: row.received_at ? formatTime(row.received_at, 'date') : '',
        [t('fleetViolationDue')]: row.due_at ? formatTime(row.due_at, 'date') : '',
        [t('fleetViolationChargeDriver')]: row.charge_driver ? t('sharedYes') : t('sharedNo'),
      }));
    } else if (view === 'byDriver') {
      data = byDriver.map((row) => ({
        [t('sharedDriver')]: row.name || t('fleetViolationNoDriver'),
        [t('fleetViolationCount')]: row.count,
        [t('fleetViolationOpen')]: row.open,
        [t('fleetViolationFine')]: row.fines,
        [t('fleetViolationPoints')]: row.points,
        [t('fleetViolationToCharge')]: row.toCharge,
      }));
    }
    const sheets = new Map();
    sheets.set(t(`fleetSafetyView${capital(view)}`), data);
    await exportExcel(t('fleetSafetyPage'), `safety-${view}.xlsx`, sheets, theme);
  };

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(`fleetSafetyView${capital(key)}`)}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => setView(key)}
    />
  ));

  const actions = (
    <>
      {(view === 'scores' || view === 'hours') && (
        <TextField
          select
          size="small"
          className={classes.period}
          label={t('fleetCostsPeriod')}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          {periods.map((value) => (
            <MenuItem key={value} value={value}>
              {formatDays(value, t)}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Button
        size="small"
        startIcon={<AssignmentTurnedInRoundedIcon />}
        component={RouterLink}
        to="/fleet/safety-officer"
      >
        {t('safetyOfficerPage')}
      </Button>
      {canWrite && settings && (
        <Button size="small" startIcon={<TuneRoundedIcon />} onClick={() => setDialog('settings')}>
          {t('fleetSafetySettings')}
        </Button>
      )}
      {canWrite && view === 'violations' && (
        <Button variant="contained" size="small" onClick={() => setDialog('violation')}>
          {t('fleetViolationAdd')}
        </Button>
      )}
      {canWrite && view === 'compliance' && (
        <>
          <Button size="small" onClick={() => setDialog('check')}>
            {t('fleetSafetyAddCheck')}
          </Button>
          <Button variant="contained" size="small" onClick={() => setDialog('training')}>
            {t('fleetSafetyAddTraining')}
          </Button>
        </>
      )}
    </>
  );

  const rows = { scores, hours, compliance, violations: records?.violations, byDriver }[view];

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetSafetyPage']}
      description={t('fleetSafetyPageDescription')}
    >
      <FleetNotice permission="safety.read" />
      <DataTable
        toolbar={
          <TableToolbar
            count={rows ? rows.length : undefined}
            filters={viewChips}
            actions={actions}
            exportHandler={rows && view !== 'compliance' ? handleExport : undefined}
          />
        }
        empty={rows != null && rows.length === 0}
        emptyState={{
          icon: <HealthAndSafetyRoundedIcon />,
          title: t(`fleetSafetyNone${capital(view)}`),
        }}
      >
        {view === 'scores' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetSafetyScore')}</TableCell>
                <TableCell>{t('fleetSafetyKm')}</TableCell>
                <TableCell>{t('fleetSafetyEvents')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={4} />}
              {scores?.map((row) => (
                <TableRow key={row.driver} hover>
                  <TableCell>
                    {driverLink(row.driver) ? (
                      <Link component={RouterLink} to={driverLink(row.driver)}>
                        {driverName(row.driver)}
                      </Link>
                    ) : (
                      driverName(row.driver)
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={scoreColor(row.score)}
                      label={row.score ?? t('fleetSafetyTooLittle')}
                    />
                  </TableCell>
                  <TableCell className={classes.number}>{formatGrouped(row.km, 0)}</TableCell>
                  <TableCell>
                    {Object.entries(row.counts)
                      .map(
                        ([category, count]) =>
                          `${t(`fleetSafetyEvent${capital(category)}`)} ${count}`,
                      )
                      .join(' · ') || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'hours' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetSafetyDrivingHours')}</TableCell>
                <TableCell>{t('fleetSafetyDrivingDays')}</TableCell>
                <TableCell>{t('fleetSafetyViolations')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={4} />}
              {hours?.map((row) => (
                <TableRow key={row.driver} hover>
                  <TableCell>{driverName(row.driver)}</TableCell>
                  <TableCell className={classes.number}>{hoursText(row.totalMinutes)}</TableCell>
                  <TableCell className={classes.number}>{row.daily.length}</TableCell>
                  <TableCell>
                    {row.violations.length === 0
                      ? '—'
                      : row.violations.map((violation) => (
                          <Tooltip
                            key={`${violation.type}-${violation.day}`}
                            title={hoursText(violation.minutes)}
                          >
                            <Chip
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ m: 0.25 }}
                              label={`${t(`fleetSafetyHours${capital(violation.type)}`)} · ${formatTime(violation.day, 'date')}`}
                            />
                          </Tooltip>
                        ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'compliance' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetSafetyLastCheck')}</TableCell>
                <TableCell>{t('fleetSafetyNextCheck')}</TableCell>
                <TableCell>{t('fleetSafetyLastTraining')}</TableCell>
                <TableCell>{t('fleetSafetyOpenViolations')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={5} />}
              {compliance?.map((row) => (
                <TableRow key={row.driver.id} hover>
                  <TableCell>
                    {row.driver.traccar_driver_id ? (
                      <Link
                        component={RouterLink}
                        to={`/fleet/driver-file/${row.driver.traccar_driver_id}`}
                      >
                        {row.driver.full_name}
                      </Link>
                    ) : (
                      row.driver.full_name
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {row.check ? formatTime(row.check.checked_at, 'date') : '—'}
                    {row.check && !row.check.license_valid && ` · ${t('fleetCheckLicenseInvalid')}`}
                  </TableCell>
                  <TableCell>
                    {row.check?.next_check_at ? (
                      <ExpiryBadge date={row.check.next_check_at} showDays />
                    ) : (
                      <Chip size="small" color="error" label={t('fleetSafetyNeverChecked')} />
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {row.training
                      ? `${formatTime(row.training.held_at, 'date')} · ${row.training.topic}`
                      : '—'}
                  </TableCell>
                  <TableCell className={classes.number}>{row.open || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'violations' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetIncidentOccurred')}</TableCell>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('sharedType')}</TableCell>
                <TableCell>{t('fleetViolationFine')}</TableCell>
                <TableCell>{t('fleetViolationPoints')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                {canWrite && <TableCell padding="checkbox" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={canWrite ? 8 : 7} />}
              {records?.violations.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={canWrite ? () => setEditing(row) : undefined}
                  sx={canWrite ? { cursor: 'pointer' } : undefined}
                >
                  <TableCell className={classes.number}>
                    {formatTime(row.occurred_at, 'minutes')}
                  </TableCell>
                  <TableCell>{row.drivers?.full_name || '—'}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.vehicles?.plate_number}</span>
                  </TableCell>
                  <TableCell>{t(violationKey('Type', row.type))}</TableCell>
                  <TableCell className={classes.number}>{money(row.fine_amount)}</TableCell>
                  <TableCell className={classes.number}>{row.points ?? ''}</TableCell>
                  <TableCell>
                    {t(violationKey('Status', row.status))}
                    {deadlineChip(row)}
                    {row.charge_driver && !row.charged_at && (
                      <Chip
                        size="small"
                        variant="outlined"
                        sx={{ mx: 0.5 }}
                        label={t('fleetViolationToCharge')}
                      />
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        aria-label={t('fleetViolationEdit')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(row);
                        }}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'byDriver' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetViolationCount')}</TableCell>
                <TableCell>{t('fleetViolationOpen')}</TableCell>
                <TableCell>{t('fleetViolationFine')}</TableCell>
                <TableCell>{t('fleetViolationPoints')}</TableCell>
                <TableCell>{t('fleetViolationToCharge')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={6} />}
              {byDriver?.map((row) => (
                <TableRow key={row.driverId || 'unknown'} hover>
                  <TableCell>
                    {row.traccarDriverId != null ? (
                      <Link component={RouterLink} to={`/fleet/driver-file/${row.traccarDriverId}`}>
                        {row.name}
                      </Link>
                    ) : (
                      row.name || t('fleetViolationNoDriver')
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>{row.count}</TableCell>
                  <TableCell className={classes.number}>{row.open}</TableCell>
                  <TableCell className={classes.number}>{money(row.fines)}</TableCell>
                  <TableCell className={classes.number}>{row.points}</TableCell>
                  <TableCell className={classes.number}>
                    {row.toCharge ? money(row.toCharge) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {(dialog === 'violation' || editing) && (
        <ViolationDialog
          key={editing?.id || 'new'}
          violation={editing}
          onClose={() => {
            setDialog(null);
            setEditing(null);
          }}
          onSaved={() => {
            setDialog(null);
            setEditing(null);
            reload();
          }}
        />
      )}
      {(dialog === 'check' || dialog === 'training') && (
        <SafetyRecordDialog
          kind={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default SafetyPage;

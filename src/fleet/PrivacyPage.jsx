import { useReducer, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import FormSection from '../settings/components/FormSection';
import OrphanFilesSection from './components/OrphanFilesSection';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { DEFAULT_POLICY } from '../common/fleet/privacy';
import FleetNotice from './components/FleetNotice';
import { privacyRegister } from '../common/fleet/privacyRegister';
import printDocument from './components/printDocument';
import { openLetterWindow } from './components/printTransferLetter';
import { telemetryStatus } from '../common/telemetry/install';
import { messagesActions } from '../store';
import { fleetConfig } from '../common/fleet/config';
import { FILES_BUCKET } from './fleetData';
import { downloadJson } from '../common/util/downloadFile';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    maxWidth: 900,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  days: {
    flexWrap: 'wrap',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  table: {
    overflowX: 'auto',
  },
  missing: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    '& li': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      paddingBlock: theme.spacing(0.25),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
}));

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const VIEW_LOG_LIMIT = 200;
const PERIOD_DAYS = 90;
const hhmm = (value) => String(value || '').slice(0, 5);

// Working hours, hiding outside them, the driver's private switch and retention.
const PolicySection = ({ policy }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [values, setValues] = useState(() => ({
    ...policy,
    work_start: hhmm(policy.work_start),
    work_end: hhmm(policy.work_end),
  }));
  const [saved, setSaved] = useState(false);
  const set = (key, value) => {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: value }));
  };
  const number = (value) => (value === '' || value == null ? null : Number(value));

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('privacy_policies')
        .upsert({
          org_id: profile.org_id,
          hide_outside_hours: values.hide_outside_hours,
          work_days: [...values.work_days].sort(),
          work_start: values.work_start,
          work_end: values.work_end,
          timezone: values.timezone || DEFAULT_POLICY.timezone,
          allow_private_switch: values.allow_private_switch,
          retention_days: number(values.retention_days),
          view_log_days: number(values.view_log_days) || DEFAULT_POLICY.view_log_days,
          updated_by: profile.id,
        }),
    );
    setSaved(true);
  });

  return (
    <FormSection
      title={t('privacyPolicy')}
      description={t('privacyPolicyHelp')}
      icon={<ScheduleRoundedIcon />}
    >
      <div className={classes.grid}>
        <FormControlLabel
          className={classes.wide}
          control={
            <Switch
              checked={values.hide_outside_hours}
              onChange={(event) => set('hide_outside_hours', event.target.checked)}
            />
          }
          label={t('privacyHideOutside')}
        />
        <div className={classes.wide}>
          <Typography variant="body2" color="textSecondary" gutterBottom id="privacy-days">
            {t('privacyWorkDays')}
          </Typography>
          <ToggleButtonGroup
            className={classes.days}
            size="small"
            value={values.work_days}
            onChange={(_, days) => set('work_days', days)}
            aria-labelledby="privacy-days"
          >
            {DAYS.map((day) => (
              <ToggleButton key={day} value={day}>
                {t(`privacyDay${day}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <TextField
          type="time"
          label={t('privacyWorkStart')}
          value={values.work_start}
          onChange={(event) => set('work_start', event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
        />
        <TextField
          type="time"
          label={t('privacyWorkEnd')}
          value={values.work_end}
          helperText={t('privacyWorkEndHelp')}
          onChange={(event) => set('work_end', event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
        />
        <FormControlLabel
          className={classes.wide}
          control={
            <Switch
              checked={values.allow_private_switch}
              onChange={(event) => set('allow_private_switch', event.target.checked)}
            />
          }
          label={t('privacyAllowSwitch')}
        />
        <TextField
          type="number"
          label={t('privacyRetention')}
          helperText={t('privacyRetentionHelp')}
          value={values.retention_days ?? ''}
          onChange={(event) => set('retention_days', event.target.value)}
          slotProps={{ htmlInput: { dir: 'ltr', min: 30, max: 3650 } }}
        />
        <TextField
          type="number"
          label={t('privacyViewLogDays')}
          helperText={t('privacyViewLogDaysHelp')}
          value={values.view_log_days ?? ''}
          onChange={(event) => set('view_log_days', event.target.value)}
          slotProps={{ htmlInput: { dir: 'ltr', min: 365, max: 3650 } }}
        />
        <div className={`${classes.actions} ${classes.wide}`}>
          <Button
            variant="contained"
            onClick={save}
            disabled={!values.work_days.length || !values.work_start || !values.work_end}
          >
            {t('sharedSave')}
          </Button>
          {saved && (
            <Typography variant="body2" role="status">
              {t('privacySaved')}
            </Typography>
          )}
        </div>
      </div>
    </FormSection>
  );
};

// The notice to employees, published in versions, and who has agreed to the current one.
const NoticeSection = ({ notices, drivers, consents, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const current = notices[0];
  const [text, setText] = useState(() => current?.body || t('privacyNoticeTemplate'));

  const agreed = new Set(
    consents.filter((row) => row.notice_version === current?.version).map((row) => row.driver_id),
  );
  const active = drivers.filter((driver) => driver.status !== 'inactive');
  const missing = active.filter((driver) => !agreed.has(driver.id));

  const publish = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('privacy_notices')
        .insert({
          org_id: profile.org_id,
          version: (current?.version || 0) + 1,
          body: text.trim(),
          published_by: profile.id,
        }),
    );
    onSaved();
  });

  const recordPaper = useCatch(async (driver) => {
    unwrap(
      await getFleetClient().from('privacy_consents').insert({
        org_id: profile.org_id,
        driver_id: driver.id,
        notice_version: current.version,
        method: 'paper',
        recorded_by: profile.id,
      }),
    );
    onSaved();
  });

  return (
    <FormSection
      title={t('privacyNotice')}
      description={t('privacyNoticeHelp')}
      icon={<DescriptionRoundedIcon />}
      actions={
        current && (
          <Chip
            size="small"
            label={t('privacyNoticeVersion')
              .replace('{0}', current.version)
              .replace('{1}', formatTime(current.published_at, 'date'))}
          />
        )
      }
    >
      <div className={classes.grid}>
        <TextField
          className={classes.wide}
          label={t('privacyNoticeText')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          multiline
          minRows={6}
        />
        <div className={`${classes.actions} ${classes.wide}`}>
          <Button
            variant="outlined"
            onClick={publish}
            disabled={!text.trim() || text.trim() === current?.body}
          >
            {t(current ? 'privacyNoticePublishNew' : 'privacyNoticePublish')}
          </Button>
        </div>
        {current && (
          <div className={classes.wide}>
            <Typography variant="body2" gutterBottom>
              {t('privacyConsentCount')
                .replace('{0}', active.length - missing.length)
                .replace('{1}', active.length)}
            </Typography>
            {missing.length > 0 && (
              <ul className={classes.missing}>
                {missing.map((driver) => (
                  <li key={driver.id}>
                    <Typography variant="body2" component="span">
                      {driver.full_name || '—'}
                    </Typography>
                    <Button size="small" onClick={() => recordPaper(driver)}>
                      {t('privacyConsentPaper')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </FormSection>
  );
};

// The private switch as recorded: who, which vehicle, from when to when.
const PeriodsSection = ({ periods, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);

  const end = useCatch(async (period) => {
    unwrap(await getFleetClient().rpc('privacy_private_end', { p_id: period.id }));
    onSaved();
  });

  return (
    <FormSection
      title={t('privacyPeriods')}
      description={t('privacyPeriodsHelp').replace('{0}', PERIOD_DAYS)}
      icon={<VisibilityOffRoundedIcon />}
    >
      {periods.length ? (
        <div className={classes.table} tabIndex={0} role="region" aria-label={t('privacyPeriods')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('privacyPeriodStart')}</TableCell>
                <TableCell>{t('privacyPeriodEnd')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell>{period.drivers?.full_name || '—'}</TableCell>
                  <TableCell>
                    {devices[period.traccar_device_id]?.name || period.traccar_device_id || '—'}
                  </TableCell>
                  <TableCell>{formatTime(period.started_at, 'minutes')}</TableCell>
                  <TableCell>
                    {period.ended_at ? (
                      formatTime(period.ended_at, 'minutes')
                    ) : (
                      <Button size="small" onClick={() => end(period)}>
                        {t('privacyPeriodEndNow')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary">
          {t('privacyPeriodsNone')}
        </Typography>
      )}
    </FormSection>
  );
};

// Who looked at which vehicles' locations, for which period.
const ViewLogSection = ({ log }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const names = (ids) =>
    ids
      .map((id) => devices[id]?.name || id)
      .slice(0, 3)
      .join(', ') + (ids.length > 3 ? ` +${ids.length - 3}` : '');

  return (
    <FormSection
      title={t('privacyViewLog')}
      description={t('privacyViewLogHelp').replace('{0}', VIEW_LOG_LIMIT)}
      icon={<ManageSearchRoundedIcon />}
    >
      {log.length ? (
        <div className={classes.table} tabIndex={0} role="region" aria-label={t('privacyViewLog')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('privacyViewedAt')}</TableCell>
                <TableCell>{t('privacyViewer')}</TableCell>
                <TableCell>{t('privacyViewKind')}</TableCell>
                <TableCell>{t('deviceTitle')}</TableCell>
                <TableCell>{t('privacyViewRange')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {log.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatTime(row.viewed_at, 'minutes')}</TableCell>
                  <TableCell>{row.profiles?.full_name || '—'}</TableCell>
                  <TableCell>{t(`privacyView${capitalize(row.view)}`)}</TableCell>
                  <TableCell>{names(row.traccar_device_ids)}</TableCell>
                  <TableCell>
                    {row.from_time
                      ? `${formatTime(row.from_time, 'minutes')} – ${formatTime(row.to_time, 'minutes')}`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Typography variant="body2" color="textSecondary">
          {t('privacyViewLogNone')}
        </Typography>
      )}
    </FormSection>
  );
};

// SEC-12: an employee's requests: see the data kept about them, or have the personal details
// erased when they leave; and the record of processing activities, to print.
const EmployeeRequestsSection = ({ drivers, policy, onDone }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const profile = useFleetProfile();
  const [driverId, setDriverId] = useState('');
  const [erasing, setErasing] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const living = drivers.filter((driver) => !driver.erased_at);
  const driver = living.find((item) => item.id === driverId);

  const exportData = useCatch(async () => {
    const data = unwrap(
      await getFleetClient().rpc('privacy_subject_export', { p_driver: driverId }),
    );
    const date = new Date().toISOString().slice(0, 10);
    // No name in the file name: the file sits in a downloads folder.
    const name = driverId.slice(0, 8);
    downloadJson(`viper-fleet_employee-data_${name}_${date}.json`, data);
    onDone();
  });

  const erase = useCatch(async () => {
    setBusy(true);
    try {
      const result = unwrap(
        await getFleetClient().rpc('privacy_erase_driver', { p_driver: driverId }),
      );
      // The database removed the rows; the files go through storage.
      const byBucket = new Map();
      (result.files || []).forEach(({ bucket, path }) =>
        byBucket.set(bucket, [...(byBucket.get(bucket) || []), path]),
      );
      for (const [bucket, paths] of byBucket) {
        const name = bucket === 'documents' ? fleetConfig.bucket : FILES_BUCKET;
        unwrap(await getFleetClient().storage.from(name).remove(paths));
      }
      dispatch(
        messagesActions.push({
          message: t('privacyEraseDone').replace('{0}', (result.files || []).length),
          severity: 'success',
        }),
      );
      setErasing(false);
      setTyped('');
      setDriverId('');
      onDone();
    } finally {
      setBusy(false);
    }
  });

  const printRegister = useCatch(async () => {
    const win = openLetterWindow();
    if (!win) {
      return;
    }
    const organization = unwrap(
      await getFleetClient()
        .from('organizations')
        .select('name')
        .eq('id', profile.org_id)
        .maybeSingle(),
    );
    const status = telemetryStatus();
    printDocument(
      win,
      {
        organization: organization?.name || '',
        date: formatTime(new Date(), 'date'),
        ...privacyRegister(t, {
          policy,
          services: { messaging: true, errors: status.errors, analytics: status.analytics },
        }),
      },
      {
        title: t('privacyRegisterTitle'),
        direction: theme.direction,
        fontFamily: theme.typography.fontFamily,
      },
    );
  });

  return (
    <FormSection
      title={t('privacyRequests')}
      description={t('privacyRequestsHelp')}
      icon={<BadgeRoundedIcon />}
    >
      <TextField
        select
        label={t('privacyRequestsDriver')}
        value={driverId}
        onChange={(event) => setDriverId(event.target.value)}
      >
        {living.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.full_name || item.id}
          </MenuItem>
        ))}
      </TextField>
      <div className={classes.actions}>
        <Button variant="outlined" onClick={exportData} disabled={!driver}>
          {t('privacyExportData')}
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => setErasing(true)}
          disabled={!driver}
        >
          {t('privacyEraseData')}
        </Button>
        <Button onClick={printRegister}>{t('privacyRegisterPrint')}</Button>
      </div>
      {erasing && driver && (
        <Dialog open onClose={() => setErasing(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('privacyEraseTitle').replace('{0}', driver.full_name || '')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('privacyEraseExplain')}
            </Typography>
            <TextField
              fullWidth
              label={t('privacyEraseType').replace('{0}', driver.full_name || '')}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setErasing(false)} autoFocus>
              {t('sharedCancel')}
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={erase}
              disabled={busy || typed.trim() !== (driver.full_name || '').trim()}
            >
              {t('privacyEraseConfirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </FormSection>
  );
};

// Fleet → Privacy (ISR-03): what the organization hides, tells its employees and records.
const PrivacyPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const allowed = useFleetPermission('privacy.manage');
  const profile = useFleetProfile();
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [data, setData] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    if (!allowed) {
      return;
    }
    const client = getFleetClient();
    const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [policy, notices, drivers, consents, periods, log] = await Promise.all([
      client.from('privacy_policies').select('*').maybeSingle(),
      client.from('privacy_notices').select('*').order('version', { ascending: false }),
      client.from('drivers').select('id, full_name, status, erased_at').order('full_name'),
      client.from('privacy_consents').select('driver_id, notice_version, method, consented_at'),
      client
        .from('privacy_private_periods')
        .select('*, drivers(full_name)')
        .or(`ended_at.is.null,started_at.gte.${since}`)
        .order('started_at', { ascending: false }),
      client
        .from('privacy_view_log')
        .select('*, profiles(full_name)')
        .order('viewed_at', { ascending: false })
        .limit(VIEW_LOG_LIMIT),
    ]);
    setData({
      policy: { ...DEFAULT_POLICY, ...unwrap(policy) },
      notices: unwrap(notices) || [],
      drivers: unwrap(drivers) || [],
      consents: unwrap(consents) || [],
      periods: unwrap(periods) || [],
      log: unwrap(log) || [],
    });
  }, [allowed, reloadKey]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'privacyPage']}
      description={t('privacyPageDescription')}
    >
      <FleetNotice permission="privacy.manage" />
      {allowed && data && (
        <div className={classes.page}>
          <Alert severity="info">{t('privacyScope')}</Alert>
          <PolicySection policy={data.policy} />
          <NoticeSection
            key={`notice-${data.notices[0]?.version || 0}`}
            notices={data.notices}
            drivers={data.drivers}
            consents={data.consents}
            onSaved={reload}
          />
          <PeriodsSection periods={data.periods} onSaved={reload} />
          <ViewLogSection log={data.log} />
          <EmployeeRequestsSection drivers={data.drivers} policy={data.policy} onDone={reload} />
          {['owner', 'admin'].includes(profile?.role) && <OrphanFilesSection />}
        </div>
      )}
    </PageLayout>
  );
};

export default PrivacyPage;

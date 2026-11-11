import { useMemo, useState } from 'react';
import {
  Chip,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import ViewQuiltRoundedIcon from '@mui/icons-material/ViewQuiltRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableShimmer from '../common/components/TableShimmer';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { release as currentRelease, telemetryStatus } from '../common/telemetry/install';
import { formatTime } from '../common/util/formatter';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import KpiTile from '../common/components/KpiTile';
import { fill, formatDuration, formatVital, releaseHealth, releasesOf } from './clientHealth';
import { useAdminAccess } from './useAdmin';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 3, 0),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1, 2, 0),
    },
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  select: {
    minWidth: 170,
  },
  status: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
    gap: theme.spacing(1.5),
  },
  heading: {
    fontWeight: 600,
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
  code: {
    fontFamily: theme.typography.fontFamily,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
  },
}));

const VITAL_ICONS = {
  LCP: <ViewQuiltRoundedIcon />,
  INP: <TouchAppRoundedIcon />,
  CLS: <BrushRoundedIcon />,
  FCP: <SpeedRoundedIcon />,
  TTFB: <DnsRoundedIcon />,
};

const COUNTER_LABELS = {
  js_error: 'adminHealthJsError',
  render_error: 'adminHealthRenderError',
  chunk_load_error: 'adminHealthChunkError',
  socket_disconnect: 'adminHealthSocketDisconnect',
  socket_reconnect: 'adminHealthSocketReconnect',
  token_failure: 'adminHealthTokenFailure',
  api_error: 'adminHealthApiError',
  fleet_error: 'adminHealthFleetError',
};

const PERIODS = [1, 7, 30];

// Durations ("2.1 s") read left to right inside Hebrew text.
const Ltr = ({ children }) => <bdi dir="ltr">{children}</bdi>;

// Service management → interface health (FND-06): how fast and how stable the interface is for
// customers, per release: web vitals (75th percentile), long tasks and operational counters from
// client_metrics, and which reporting services this build sends to. Platform administrators only.
const ClientHealthPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [chosen, setChosen] = useState(null);
  const status = telemetryStatus();
  const access = useAdminAccess();

  useAsyncTask(
    async ({ signal }) => {
      if (!access.customersRead) {
        return;
      }
      setRows(null);
      setRows(
        unwrap(
          await getFleetClient()
            .rpc('client_metrics_overview', { p_days: days })
            .abortSignal(signal),
        ) || [],
      );
    },
    [access.customersRead, days],
  );

  const releases = useMemo(() => releasesOf(rows), [rows]);
  const release = releases.includes(chosen) ? chosen : releases[0] || null;
  const health = useMemo(() => releaseHealth(rows, release), [rows, release]);
  const number = (value) => Number(value).toLocaleString(language);
  const percent = (value) =>
    Number(value).toLocaleString(language, { style: 'percent', maximumFractionDigits: 0 });

  const counterLabel = (group) => (COUNTER_LABELS[group] ? t(COUNTER_LABELS[group]) : group);

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminHealth']}
      description={t('adminHealthDescription')}
      actions={
        <div className={classes.actions}>
          <TextField
            select
            size="small"
            className={classes.select}
            label={t('adminHealthRelease')}
            value={release || ''}
            onChange={(event) => setChosen(event.target.value)}
            disabled={!releases.length}
          >
            {releases.map((item) => (
              <MenuItem key={item} value={item}>
                <span dir="ltr">{item}</span>
                {item === currentRelease ? ` · ${t('adminHealthThisRelease')}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            className={classes.select}
            label={t('adminHealthPeriod')}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {PERIODS.map((item) => (
              <MenuItem key={item} value={item}>
                {t(`adminHealthDays${item}`)}
              </MenuItem>
            ))}
          </TextField>
        </div>
      }
    >
      <AdminGate need="customersRead" />
      {access.customersRead && (
        <>
          <div className={classes.root}>
            <div className={classes.status} role="group" aria-label={t('adminHealthServices')}>
              <Chip
                size="small"
                variant="outlined"
                color={status.errors ? 'success' : 'default'}
                label={`${t('adminHealthErrors')}: ${status.errors || t('adminHealthOff')}`}
              />
              <Chip
                size="small"
                variant="outlined"
                color={status.analytics ? 'success' : 'default'}
                label={`${t('adminHealthAnalytics')}: ${status.analytics || t('adminHealthOff')}`}
              />
              <Chip
                size="small"
                variant="outlined"
                color={status.metrics ? 'success' : 'default'}
                label={`${t('adminHealthMetrics')}: ${t(status.metrics ? 'adminHealthOn' : 'adminHealthOff')}`}
              />
            </div>
            <div className={classes.kpis}>
              {health.vitals.map((vital) => (
                <KpiTile
                  key={vital.name}
                  icon={VITAL_ICONS[vital.name]}
                  label={t(`adminHealthVital${vital.name}`)}
                  value={rows ? <Ltr>{formatVital(vital.name, vital.p75, language)}</Ltr> : '–'}
                  tone={vital.rating === 'poor' ? 'alert' : 'default'}
                  wrapHint
                  hint={[
                    vital.name,
                    ...(vital.samples
                      ? [
                          t(`adminHealthRating_${vital.rating}`),
                          t('adminHealthGoodShare').replace('{0}', percent(vital.good)),
                          t('adminHealthSamples').replace('{0}', number(vital.samples)),
                        ]
                      : [t('adminHealthNoSamples')]),
                  ].join(' · ')}
                />
              ))}
            </div>
            <Typography component="h2" variant="subtitle1" className={classes.heading}>
              {t('adminHealthCounters')}
            </Typography>
          </div>
          <DataTable
            empty={rows && !health.counters.length && !health.longTasks}
            emptyState={{ icon: <MonitorHeartRoundedIcon />, title: t('adminHealthNone') }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('adminHealthCounter')}</TableCell>
                <TableCell>{t('adminHealthDetail')}</TableCell>
                <TableCell>{t('adminHealthTotal')}</TableCell>
                <TableCell>{t('adminHealthOrgs')}</TableCell>
                <TableCell>{t('adminHealthLast')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows ? (
                <>
                  {health.counters.map((counter) => (
                    <TableRow key={counter.name} hover>
                      <TableCell>{counterLabel(counter.group)}</TableCell>
                      <TableCell>
                        <span className={classes.code} dir="ltr">
                          {counter.detail || '–'}
                        </span>
                      </TableCell>
                      <TableCell className={classes.number}>{number(counter.total)}</TableCell>
                      <TableCell className={classes.number}>{number(counter.orgs)}</TableCell>
                      <TableCell>{formatTime(counter.lastAt, 'minutes')}</TableCell>
                    </TableRow>
                  ))}
                  {health.longTasks && (
                    <TableRow hover>
                      <TableCell>{t('adminHealthLongTasks')}</TableCell>
                      <TableCell>
                        {fill(t('adminHealthLongTasksDetail'), [
                          <Ltr key="total">
                            {formatDuration(health.longTasks.totalMs, language)}
                          </Ltr>,
                          <Ltr key="max">{formatDuration(health.longTasks.maxMs, language)}</Ltr>,
                        ])}
                      </TableCell>
                      <TableCell className={classes.number}>
                        {number(health.longTasks.count)}
                      </TableCell>
                      <TableCell>–</TableCell>
                      <TableCell>–</TableCell>
                    </TableRow>
                  )}
                </>
              ) : (
                <TableShimmer columns={5} />
              )}
            </TableBody>
          </DataTable>
        </>
      )}
    </PageLayout>
  );
};

export default ClientHealthPage;

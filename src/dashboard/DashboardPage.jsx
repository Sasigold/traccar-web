import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Button, ButtonBase, Paper, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import BatteryAlertRoundedIcon from '@mui/icons-material/BatteryAlertRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageHeader from '../common/components/shell/PageHeader';
import EmptyState from '../common/components/table/EmptyState';
import { useAttributePreference } from '../common/util/preferences';
import { formatNotificationTitle, formatSpeed } from '../common/util/formatter';
import {
  distanceFromMeters,
  distanceUnitString,
  speedFromKnots,
  speedUnitString,
} from '../common/util/converter';
import { devicesActions } from '../store';
import { gridPattern } from '../common/theme/surfaces';
import { navy, signal } from '../common/theme/tokens';
import { eventIconKey, eventIcons, mapIconKey, mapIcons } from '../map/core/preloadImages';
import useFleetSnapshot, { fleetStates } from './useFleetSnapshot';

const stateLabelKeys = {
  moving: 'dashboardStateMoving',
  stopped: 'dashboardStateStopped',
  offline: 'deviceStatusOffline',
  unknown: 'dashboardStateNoData',
};

export const useStateColors = () => {
  const theme = useTheme();
  return {
    moving: theme.palette.success.main,
    stopped: theme.palette.info.main,
    offline: theme.palette.error.main,
    unknown: theme.palette.neutral.main,
  };
};

const useStyles = makeStyles()((theme) => ({
  page: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 3, 3),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 1.5, 2),
      gap: theme.spacing(1.5),
    },
  },
  span12: { gridColumn: 'span 12' },
  span8: {
    gridColumn: 'span 8',
    [theme.breakpoints.down('lg')]: { gridColumn: 'span 12' },
  },
  span4: {
    gridColumn: 'span 4',
    [theme.breakpoints.down('lg')]: { gridColumn: 'span 6' },
    [theme.breakpoints.down('md')]: { gridColumn: 'span 12' },
  },
  // Hero command strip
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.tokens.radius.xxl,
    padding: theme.spacing(3, 3.5),
    color: '#ffffff',
    border: `1px solid ${alpha(signal[300], 0.14)}`,
    background: `linear-gradient(120deg, ${navy[900]} 0%, #0b2246 45%, ${navy[700]} 100%)`,
    boxShadow: `0 24px 48px -24px ${alpha(navy[900], 0.6)}`,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: theme.spacing(3),
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      ...gridPattern(alpha('#ffffff', 0.045), 28),
      maskImage: 'linear-gradient(90deg, transparent, black 60%)',
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 420,
      height: 420,
      top: -220,
      insetInlineEnd: -120,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${alpha(signal[400], 0.32)}, transparent 65%)`,
      pointerEvents: 'none',
    },
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2.5, 2),
      borderRadius: theme.tokens.radius.xl,
    },
  },
  heroText: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  heroEyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: signal[200],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: signal[400],
    boxShadow: `0 0 0 4px ${alpha(signal[400], 0.22)}`,
    animation: 'dashPulse 2s ease-in-out infinite',
    '@keyframes dashPulse': {
      '0%, 100%': { boxShadow: `0 0 0 3px ${alpha(signal[400], 0.25)}` },
      '50%': { boxShadow: `0 0 0 7px ${alpha(signal[400], 0.05)}` },
    },
  },
  heroTitle: {
    fontSize: 'clamp(1.375rem, 2.2vw, 1.875rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  heroSummary: {
    color: alpha('#ffffff', 0.72),
    fontSize: '0.9375rem',
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  heroPrimary: {
    color: navy[950],
    backgroundColor: '#ffffff',
    '&:hover': { backgroundColor: signal[50] },
  },
  heroSecondary: {
    color: '#ffffff',
    borderColor: alpha('#ffffff', 0.24),
    backgroundColor: alpha('#ffffff', 0.04),
    '&:hover': {
      borderColor: alpha('#ffffff', 0.4),
      backgroundColor: alpha('#ffffff', 0.1),
    },
  },
  heroStats: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(118px, 1fr))',
    gap: theme.spacing(1.25),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  heroStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: theme.spacing(1.5, 1.75),
    borderRadius: theme.tokens.radius.lg,
    background: alpha('#ffffff', 0.05),
    border: `1px solid ${alpha('#ffffff', 0.1)}`,
    backdropFilter: 'blur(10px)',
  },
  heroStatHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    color: alpha('#ffffff', 0.6),
    fontSize: '0.75rem',
    fontWeight: 600,
    '& svg': { fontSize: 18, color: signal[300] },
  },
  heroStatValue: {
    fontSize: '1.75rem',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    '& small': {
      fontSize: '0.8125rem',
      fontWeight: 600,
      color: alpha('#ffffff', 0.55),
      marginInlineStart: 4,
    },
  },
  meter: {
    height: 4,
    borderRadius: 4,
    background: alpha('#ffffff', 0.1),
    overflow: 'hidden',
    '& span': {
      display: 'block',
      height: '100%',
      borderRadius: 4,
      background: `linear-gradient(90deg, ${signal[400]}, ${navy[300]})`,
      transition: 'width 600ms ease',
    },
  },
  // Cards
  card: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(2, 2.25, 1),
  },
  cardIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
    '& svg': { fontSize: 18 },
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.9375rem',
    fontWeight: 700,
  },
  cardSubtitle: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  cardBody: {
    padding: theme.spacing(1, 2.25, 2.25),
    flex: 1,
    minHeight: 0,
  },
  // Donut
  donutWrap: {
    display: 'grid',
    gridTemplateColumns: '150px minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  donut: {
    position: 'relative',
    width: 150,
    height: 150,
  },
  donutCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    '& strong': {
      fontSize: '1.75rem',
      fontWeight: 800,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    },
    '& span': {
      fontSize: '0.6875rem',
      color: theme.palette.text.secondary,
      fontWeight: 600,
      marginTop: 4,
    },
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  legendRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.8125rem',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendValue: {
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  legendPct: {
    minWidth: 36,
    textAlign: 'end',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  chartBox: {
    height: 170,
    direction: 'ltr',
  },
  tooltip: {
    padding: theme.spacing(0.75, 1.25),
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    boxShadow: theme.shadows[3],
    fontSize: '0.75rem',
    direction: theme.direction,
    '& strong': { display: 'block', fontSize: '0.8125rem' },
  },
  // Lists
  list: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: theme.spacing(1),
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 2.25),
    textAlign: 'start',
    transition: 'background-color 120ms ease',
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
  },
  feedIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.warning.main, 0.14),
    '& img': {
      width: 16,
      height: 16,
      filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
      opacity: 0.8,
    },
  },
  feedText: {
    flex: 1,
    minWidth: 0,
  },
  feedTime: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  vehicleRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) 20px',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.1, 2.25),
    textAlign: 'start',
    borderTop: `1px solid ${theme.palette.surface.border}`,
    transition: 'background-color 120ms ease',
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      '& > :nth-of-type(3), & > :nth-of-type(4), & > :nth-of-type(5)': { display: 'none' },
    },
  },
  vehicleHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) 20px',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 2.25),
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.surface.sunken,
    [theme.breakpoints.down('sm')]: { display: 'none' },
  },
  vehicleName: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  vehicleAvatar: {
    position: 'relative',
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& img': {
      width: 18,
      height: 18,
      filter: 'brightness(0) invert(1)',
    },
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingInline: 8,
    borderRadius: theme.tokens.radius.pill,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    width: 'fit-content',
    '&::before': {
      content: '""',
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
    },
  },
  numeric: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    fontSize: '0.8125rem',
    whiteSpace: 'nowrap',
  },
  muted: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chevron: {
    fontSize: 18,
    color: theme.palette.text.disabled,
  },
  attentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 2.25),
    textAlign: 'start',
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
  },
  attentionIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': { fontSize: 18 },
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 2.25, 2.25),
  },
  metric: {
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    border: `1px solid ${theme.palette.surface.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  metricLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    '& svg': { fontSize: 15 },
  },
  metricValue: {
    fontSize: '1.125rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },
}));

const CardHeader = ({ icon, title, subtitle, action }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.cardHead}>
      <span className={classes.cardIcon}>{icon}</span>
      <div className={classes.cardTitle}>
        <Typography component="h2" className={classes.cardTitle}>
          {title}
        </Typography>
        {subtitle && <Typography className={classes.cardSubtitle}>{subtitle}</Typography>}
      </div>
      {action}
    </div>
  );
};

const greetingKey = () => {
  const hour = dayjs().hour();
  if (hour < 5) return 'dashboardGreetingNight';
  if (hour < 12) return 'dashboardGreetingMorning';
  if (hour < 18) return 'dashboardGreetingAfternoon';
  return 'dashboardGreetingEvening';
};

const percent = (value, total) => (total ? Math.round((value / total) * 100) : 0);

const DashboardPage = () => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const colors = useStateColors();
  const snapshot = useFleetSnapshot();

  const user = useSelector((state) => state.session.user);
  const devices = useSelector((state) => state.devices.items);
  const speedUnit = useAttributePreference('speedUnit');
  const distanceUnit = useAttributePreference('distanceUnit');

  const rtl = theme.direction === 'rtl';
  const Chevron = rtl ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;

  const openOnMap = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };

  const statusData = fleetStates
    .map((state) => ({ state, value: snapshot.counts[state] }))
    .filter((item) => item.value > 0);

  const speedBuckets = useMemo(() => {
    const limits = [0, 30, 60, 90];
    const buckets = limits.map((from, index) => ({
      from,
      to: limits[index + 1],
      count: 0,
    }));
    snapshot.vehicles.forEach(({ state, position }) => {
      if (state !== 'moving') return;
      const speed = speedFromKnots(position.speed || 0, speedUnit);
      const bucket = [...buckets].reverse().find((b) => speed >= b.from);
      if (bucket) bucket.count += 1;
    });
    return buckets.map((b) => ({
      ...b,
      // Isolate as LTR so ranges never flip in RTL layouts.
      label: `\u2066${b.to ? `${b.from}–${b.to}` : `${b.from}+`}\u2069`,
    }));
  }, [snapshot.vehicles, speedUnit]);

  const formatEvent = (event) =>
    formatNotificationTitle(t, {
      type: event.type,
      attributes: { alarms: event.attributes?.alarm },
    });

  const attentionIcon = {
    noData: <HelpOutlineRoundedIcon />,
    offline: <CloudOffRoundedIcon />,
    offlineLong: <CloudOffRoundedIcon />,
    lowBattery: <BatteryAlertRoundedIcon />,
  };
  const severityColor = {
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    neutral: theme.palette.text.secondary,
  };

  const firstName = (user?.name || '').split(' ')[0];
  const unitLabel = speedUnitString(speedUnit, t);

  return (
    <div className={classes.page}>
      <PageHeader title={t('shellDashboard')} description={dayjs().format('dddd, D MMMM YYYY')} />
      <div className={classes.grid}>
        <section className={cx(classes.hero, classes.span12)}>
          <div className={classes.heroText}>
            <span className={classes.heroEyebrow}>
              <span className={classes.liveDot} />
              {t('dashboardLiveSnapshot')}
            </span>
            <Typography component="h1" className={classes.heroTitle}>
              {`${t(greetingKey())}${firstName ? `, ${firstName}` : ''}`}
            </Typography>
            <Typography className={classes.heroSummary}>
              {t('dashboardSummary')
                .replace('{active}', snapshot.active)
                .replace('{total}', snapshot.total)
                .replace('{moving}', snapshot.counts.moving)}
            </Typography>
            <div className={classes.heroActions}>
              <Button
                variant="contained"
                className={classes.heroPrimary}
                startIcon={<MapRoundedIcon />}
                component={Link}
                to="/"
              >
                {t('shellLiveMap')}
              </Button>
              <Button
                variant="outlined"
                className={classes.heroSecondary}
                startIcon={<InsightsRoundedIcon />}
                component={Link}
                to="/reports/summary"
              >
                {t('reportTitle')}
              </Button>
            </div>
          </div>
          <div className={classes.heroStats}>
            {[
              {
                key: 'active',
                label: t('dashboardActiveNow'),
                icon: <SensorsRoundedIcon />,
                value: snapshot.active,
                suffix: `/ ${snapshot.total}`,
                ratio: percent(snapshot.active, snapshot.total),
              },
              {
                key: 'moving',
                label: t('dashboardStateMoving'),
                icon: <NavigationRoundedIcon />,
                value: snapshot.counts.moving,
                suffix: `(${percent(snapshot.counts.moving, snapshot.total)}%)`,
                ratio: percent(snapshot.counts.moving, snapshot.total),
              },
              {
                key: 'speed',
                label: t('dashboardAverageSpeed'),
                icon: <SpeedRoundedIcon />,
                value: Math.round(speedFromKnots(snapshot.averageMovingSpeed, speedUnit)),
                suffix: unitLabel,
                ratio: Math.min(
                  100,
                  Math.round(speedFromKnots(snapshot.averageMovingSpeed, 'kmh')),
                ),
              },
              {
                key: 'events',
                label: t('dashboardAlertsToday'),
                icon: <NotificationsActiveRoundedIcon />,
                value: snapshot.eventsToday,
                ratio: Math.min(100, snapshot.eventsToday * 10),
              },
            ].map((stat) => (
              <div key={stat.key} className={classes.heroStat}>
                <span className={classes.heroStatHead}>
                  {stat.label}
                  {stat.icon}
                </span>
                <span className={classes.heroStatValue}>
                  {stat.value}
                  {stat.suffix && <small>{stat.suffix}</small>}
                </span>
                <span className={classes.meter}>
                  <span style={{ width: `${stat.ratio}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <Paper elevation={0} className={cx(classes.card, classes.span4)}>
          <CardHeader
            icon={<SensorsRoundedIcon />}
            title={t('dashboardFleetStatus')}
            subtitle={t('dashboardFleetStatusHint')}
          />
          <div className={classes.cardBody}>
            <div className={classes.donutWrap}>
              <div className={classes.donut}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData.length ? statusData : [{ state: 'empty', value: 1 }]}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={statusData.length > 1 ? 3 : 0}
                      cornerRadius={4}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {(statusData.length ? statusData : [{ state: 'empty' }]).map((item) => (
                        <Cell
                          key={item.state}
                          fill={colors[item.state] || theme.palette.surface.sunken}
                        />
                      ))}
                    </Pie>
                    {statusData.length > 0 && (
                      <ChartTooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className={classes.tooltip}>
                              <strong>{t(stateLabelKeys[payload[0].payload.state])}</strong>
                              {`${payload[0].value} · ${percent(payload[0].value, snapshot.total)}%`}
                            </div>
                          ) : null
                        }
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
                <div className={classes.donutCenter}>
                  <strong>{snapshot.total}</strong>
                  <span>{t('shellVehicles')}</span>
                </div>
              </div>
              <div className={classes.legend}>
                {fleetStates.map((state) => (
                  <div key={state} className={classes.legendRow}>
                    <span className={classes.legendSwatch} style={{ background: colors[state] }} />
                    <span>{t(stateLabelKeys[state])}</span>
                    <span className={classes.legendValue}>{snapshot.counts[state]}</span>
                    <span className={classes.legendPct}>
                      {`${percent(snapshot.counts[state], snapshot.total)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Paper>

        <Paper elevation={0} className={cx(classes.card, classes.span4)}>
          <CardHeader
            icon={<SpeedRoundedIcon />}
            title={t('dashboardSpeedProfile')}
            subtitle={`${t('dashboardSpeedProfileHint')} (${unitLabel})`}
          />
          <div className={classes.cardBody}>
            <div className={classes.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedBuckets} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke={theme.palette.surface.border}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  />
                  <ChartTooltip
                    cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className={classes.tooltip}>
                          <strong>{`${payload[0].payload.label} ${unitLabel}`}</strong>
                          {`${payload[0].value} ${t('shellVehicles')}`}
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill={theme.palette.primary.main}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Paper>

        <Paper elevation={0} className={cx(classes.card, classes.span4)}>
          <CardHeader
            icon={<NotificationsActiveRoundedIcon />}
            title={t('dashboardLiveAlerts')}
            subtitle={t('dashboardLiveAlertsHint')}
          />
          {snapshot.events.length === 0 ? (
            <EmptyState
              compact
              icon={<TaskAltRoundedIcon />}
              title={t('dashboardAllClear')}
              description={t('dashboardAllClearHint')}
            />
          ) : (
            <div className={classes.list}>
              {snapshot.events.slice(0, 5).map((event) => (
                <ButtonBase
                  key={event.id ?? `${event.deviceId}-${event.eventTime}`}
                  className={classes.feedItem}
                  onClick={() => event.id && navigate(`/event/${event.id}`)}
                >
                  <span className={classes.feedIcon}>
                    <img src={eventIcons[eventIconKey(event.type)]} alt="" />
                  </span>
                  <div className={classes.feedText}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {devices[event.deviceId]?.name}
                    </Typography>
                    <Typography className={classes.muted}>{formatEvent(event)}</Typography>
                  </div>
                  <span className={classes.feedTime}>{dayjs(event.eventTime).fromNow()}</span>
                </ButtonBase>
              ))}
            </div>
          )}
        </Paper>

        <Paper elevation={0} className={cx(classes.card, classes.span8)}>
          <CardHeader
            icon={<MapRoundedIcon />}
            title={t('dashboardVehicleBoard')}
            subtitle={t('dashboardVehicleBoardHint')}
            action={
              <Button size="small" component={Link} to="/settings/devices" endIcon={<Chevron />}>
                {t('dashboardViewAll')}
              </Button>
            }
          />
          <div className={classes.vehicleHead}>
            <span>{t('sharedName')}</span>
            <span>{t('deviceStatus')}</span>
            <span>{t('positionSpeed')}</span>
            <span>{t('deviceLastUpdate')}</span>
            <span />
          </div>
          {snapshot.vehicles.length === 0 ? (
            <EmptyState compact title={t('shellNoDevices')} />
          ) : (
            <div className={classes.list} style={{ paddingBottom: 0 }}>
              {snapshot.vehicles.slice(0, 8).map(({ device, position, state }) => (
                <ButtonBase
                  key={device.id}
                  className={classes.vehicleRow}
                  onClick={() => openOnMap(device.id)}
                >
                  <span className={classes.vehicleName}>
                    <span
                      className={classes.vehicleAvatar}
                      style={{
                        background: `linear-gradient(135deg, ${colors[state]}, ${alpha(colors[state], 0.7)})`,
                        boxShadow: `0 4px 12px -4px ${alpha(colors[state], 0.6)}`,
                      }}
                    >
                      <img src={mapIcons[mapIconKey(device.category)]} alt="" />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {device.name}
                      </Typography>
                      <Typography className={classes.muted} dir="auto">
                        {position?.address || device.uniqueId}
                      </Typography>
                    </span>
                  </span>
                  <span
                    className={classes.chip}
                    style={{ color: colors[state], backgroundColor: alpha(colors[state], 0.12) }}
                  >
                    {t(stateLabelKeys[state])}
                  </span>
                  <span className={classes.numeric}>
                    {position ? formatSpeed(position.speed, speedUnit, t) : '—'}
                  </span>
                  <Tooltip title={device.lastUpdate ? dayjs(device.lastUpdate).format('L LT') : ''}>
                    <span className={classes.muted}>
                      {device.lastUpdate ? dayjs(device.lastUpdate).fromNow() : '—'}
                    </span>
                  </Tooltip>
                  <Chevron className={classes.chevron} />
                </ButtonBase>
              ))}
            </div>
          )}
        </Paper>

        <Paper elevation={0} className={cx(classes.card, classes.span4)}>
          <CardHeader
            icon={<WarningAmberRoundedIcon />}
            title={t('dashboardAttention')}
            subtitle={t('dashboardAttentionHint')}
          />
          <div className={classes.metrics}>
            <div className={classes.metric}>
              <span className={classes.metricLabel}>
                <PowerSettingsNewRoundedIcon />
                {t('dashboardIgnitionOn')}
              </span>
              <span className={classes.metricValue}>{snapshot.ignitionOn}</span>
            </div>
            <div className={classes.metric}>
              <span className={classes.metricLabel}>
                <NavigationRoundedIcon />
                {t('dashboardFleetOdometer')}
              </span>
              <span className={classes.metricValue}>
                {snapshot.odometer != null
                  ? `${Math.round(distanceFromMeters(snapshot.odometer, distanceUnit)).toLocaleString()} ${distanceUnitString(distanceUnit, t)}`
                  : '—'}
              </span>
            </div>
          </div>
          {snapshot.attention.length === 0 ? (
            <EmptyState
              compact
              icon={<TaskAltRoundedIcon />}
              title={t('dashboardAllClear')}
              description={t('dashboardNoIssues')}
            />
          ) : (
            <div className={classes.list}>
              {snapshot.attention.slice(0, 5).map((item) => (
                <ButtonBase
                  key={`${item.device.id}-${item.reason}`}
                  className={classes.attentionItem}
                  onClick={() => openOnMap(item.device.id)}
                >
                  <span
                    className={classes.attentionIcon}
                    style={{
                      color: severityColor[item.severity],
                      backgroundColor: alpha(severityColor[item.severity], 0.12),
                    }}
                  >
                    {attentionIcon[item.reason]}
                  </span>
                  <div className={classes.feedText}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {item.device.name}
                    </Typography>
                    <Typography className={classes.muted}>
                      {item.reason === 'lowBattery'
                        ? `${t('dashboardReasonLowBattery')} · ${item.value}%`
                        : item.since
                          ? `${t(`dashboardReason${item.reason.charAt(0).toUpperCase()}${item.reason.slice(1)}`)} · ${dayjs(item.since).fromNow()}`
                          : t('dashboardReasonNoData')}
                    </Typography>
                  </div>
                  <Chevron className={classes.chevron} />
                </ButtonBase>
              ))}
            </div>
          )}
        </Paper>
      </div>
    </div>
  );
};

export default DashboardPage;

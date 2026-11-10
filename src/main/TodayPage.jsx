import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ButtonBase, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useShell } from '../common/components/shell/ShellContext';
import { savePersistedState } from '../common/util/usePersistedState';
import { unreadCount } from '../common/util/eventSeverity';
import { todaySummary } from './today';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3, 2, 4),
    width: '100%',
    maxWidth: 560,
    marginInline: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  greeting: {
    fontWeight: 600,
  },
  // The brand mockup's hero tile: navy with the number in white and an aqua label.
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    borderRadius: theme.tokens.radius.xxl,
    backgroundColor: theme.palette.brand.navy,
    color: theme.palette.brand.white,
    border: theme.palette.mode === 'dark' ? `1px solid ${theme.palette.brand.aqua}` : 'none',
    textAlign: 'start',
    width: '100%',
  },
  heroNumber: {
    fontSize: '3.5rem',
    lineHeight: 1,
    fontWeight: 600,
  },
  heroLabel: {
    color: theme.palette.brand.aqua,
    fontWeight: 600,
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    textAlign: 'start',
  },
  tileNumber: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  tileLabel: {
    color: theme.palette.surface.textSecondaryOnTint,
    fontSize: '0.8125rem',
  },
  shortcuts: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  shortcut: {
    width: '100%',
    justifyContent: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    fontSize: '1rem',
    fontWeight: 500,
  },
  grow: {
    flexGrow: 1,
    textAlign: 'start',
  },
}));

const EMPTY_FILTER = { activities: [], statuses: [], groups: [], geofences: [] };

// LIV-23: the phone's first tab, after page 15 of the brand book: a greeting, the number that
// matters (vehicles moving), tiles for the rest, and the three most used destinations.
const TodayPage = () => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { openEvents } = useShell();

  const user = useSelector((state) => state.session.user);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const unread = useSelector((state) => unreadCount(state.events.items, state.events.lastSeen));
  const fleetAlerts = useSelector((state) => state.fleet.alertsCount);

  // The counts follow the clock too (a vehicle goes stale without a new message).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const summary = useMemo(() => todaySummary(devices, positions, now), [devices, positions, now]);

  useEffect(() => {
    document.title = `${t('todayTitle')} · viper fleet`;
  }, [t]);

  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const Chevron = theme.direction === 'rtl' ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;

  // A tile opens the map filtered to what it counts.
  const showOnMap = (activity) => {
    savePersistedState('deviceFilter', { ...EMPTY_FILTER, activities: activity ? [activity] : [] });
    navigate('/');
  };

  const tiles = [
    {
      key: 'stopped',
      label: t('todayStopped'),
      value: summary.stopped,
      onClick: () => showOnMap('stopped'),
    },
    {
      key: 'offline',
      label: t('todayOffline'),
      value: summary.offline,
      onClick: () => showOnMap('offline'),
    },
    {
      key: 'alerts',
      label: t('sharedNotifications'),
      value: unread + (fleetAlerts || 0),
      onClick: openEvents,
    },
  ];

  const shortcuts = [
    {
      key: 'map',
      label: t('mapLiveTitle'),
      icon: <MapRoundedIcon />,
      onClick: () => showOnMap(null),
    },
    {
      key: 'trips',
      label: t('todayTripsReport'),
      icon: <RouteRoundedIcon />,
      onClick: () => navigate('/reports/trips'),
    },
    {
      key: 'alerts',
      label: t('sharedNotifications'),
      icon: <NotificationsRoundedIcon />,
      onClick: openEvents,
    },
  ];

  return (
    <div className={classes.root}>
      <div>
        <Typography variant="h5" component="h1" className={classes.greeting}>
          {firstName ? t('todayHello').replace('{0}', firstName) : t('todayHelloAnonymous')}
        </Typography>
        <Typography color="textSecondary">{t('todaySubtitle')}</Typography>
      </div>
      <ButtonBase className={classes.hero} onClick={() => showOnMap('moving')}>
        <span className={classes.heroNumber} dir="ltr">
          {summary.moving}
        </span>
        <span className={classes.heroLabel}>{t('todayMoving')}</span>
      </ButtonBase>
      <div className={classes.tiles}>
        {tiles.map((tile) => (
          <ButtonBase key={tile.key} className={classes.tile} onClick={tile.onClick}>
            <span className={classes.tileNumber}>{tile.value}</span>
            <span className={classes.tileLabel}>{tile.label}</span>
          </ButtonBase>
        ))}
      </div>
      <ul className={classes.shortcuts} aria-label={t('todayShortcuts')}>
        {shortcuts.map((item) => (
          <li key={item.key}>
            <ButtonBase className={classes.shortcut} onClick={item.onClick}>
              {item.icon}
              <span className={classes.grow}>{item.label}</span>
              <Chevron fontSize="small" />
            </ButtonBase>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodayPage;

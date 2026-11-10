import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, BottomNavigation, BottomNavigationAction } from '@mui/material';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { makeStyles } from 'tss-react/mui';
import { ctaFill } from '../../theme/surfaces';
import { useTranslation } from '../LocalizationProvider';
import useNavItems from './navItems';
import MoreSheet from './MoreSheet';
import { useShell } from './ShellContext';
import useFeatures from '../../util/useFeatures';
import { unreadCount } from '../../util/eventSeverity';
import { useConfirm } from '../confirm/ConfirmProvider';
import { useLeaveGuard } from '../confirm/unsavedChanges';

const useStyles = makeStyles()((theme) => ({
  root: {
    flexShrink: 0,
    height: `calc(${theme.dimensions.mobileTabsHeight}px + env(safe-area-inset-bottom, 0px))`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: theme.layers.mobileTabs,
    '@media print': {
      display: 'none',
    },
  },
  action: {
    minWidth: 0,
    paddingTop: 8,
    gap: 4,
    color: theme.palette.text.secondary,
    // Active tab: aqua pill behind the icon with ink glyph, label in the text color.
    '& .vf-tab-indicator': {
      width: 56,
      height: 32,
      borderRadius: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: theme.transitions.create('background-color', { duration: 160 }),
    },
    '&:hover .vf-tab-indicator': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-selected': {
      color: theme.palette.text.primary,
      '& .vf-tab-indicator': {
        ...ctaFill(theme),
      },
    },
    '& .MuiBottomNavigationAction-label': {
      fontSize: '0.6875rem',
      fontWeight: 500,
      '&.Mui-selected': {
        fontSize: '0.6875rem',
        fontWeight: 600,
      },
    },
  },
}));

// LIV-09: at most five tabs: three destinations, alerts and "More". LIV-23: the three are the
// first available of today, the map, the fleet, a driver's area and reports; the rest
// (dashboard, geofences, settings, the admin area, the account) is in "More". The trips report
// is also a shortcut on "Today".
const TAB_ORDER = ['today', 'map', 'fleet', 'driver', 'reports'];
const TAB_COUNT = 3;

const MobileTabs = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();
  const features = useFeatures();
  const { openEvents, eventsOpen } = useShell();
  // ADM-05: unsaved changes are asked about before leaving.
  const leave = useLeaveGuard(useConfirm(), t);
  const navItems = useNavItems();
  const tabKeys = TAB_ORDER.filter((key) => navItems.some((item) => item.key === key)).slice(
    0,
    TAB_COUNT,
  );
  const items = tabKeys.map((key) => navItems.find((item) => item.key === key));
  const moreItems = navItems.filter((item) => !tabKeys.includes(item.key));
  const alerts = !features.disableEvents;

  const socket = useSelector((state) => state.session.socket);
  const unread = useSelector((state) => unreadCount(state.events.items, state.events.lastSeen));
  const fleetAlerts = useSelector((state) => state.fleet.alertsCount);
  const alertCount = unread + fleetAlerts;

  const [moreOpen, setMoreOpen] = useState(false);

  let current = items.find((item) => item.match(location.pathname))?.key ?? null;
  if (moreOpen || (!current && moreItems.some((item) => item.match(location.pathname)))) {
    current = 'more';
  }
  if (eventsOpen) {
    current = 'alerts';
  }

  const alertsLabel = alertCount
    ? `${t('sharedNotifications')} (${t('eventUnreadCount').replace('{0}', alertCount)})`
    : t('sharedNotifications');

  return (
    <>
      <BottomNavigation
        component="nav"
        aria-label={t('shellNavigation')}
        className={`${classes.root} app-tabs`}
        value={current}
        onChange={(event, value) => {
          if (value === 'more') {
            setMoreOpen(true);
          } else if (value === 'alerts') {
            openEvents();
          } else {
            const item = items.find((it) => it.key === value);
            if (item) {
              leave(() => navigate(item.path));
            }
          }
        }}
        showLabels
      >
        {items.map((item) => {
          const Icon = item.icon;
          const icon =
            item.key === 'map' ? (
              <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
                <Icon />
              </Badge>
            ) : (
              <Icon />
            );
          return (
            <BottomNavigationAction
              key={item.key}
              className={classes.action}
              label={t(item.titleKey)}
              icon={<span className="vf-tab-indicator">{icon}</span>}
              value={item.key}
            />
          );
        })}
        {alerts && (
          <BottomNavigationAction
            className={classes.action}
            label={t('sharedNotifications')}
            aria-label={alertsLabel}
            icon={
              <span className="vf-tab-indicator">
                {alertCount ? (
                  <Badge badgeContent={alertCount} max={99} color="error">
                    <NotificationsRoundedIcon />
                  </Badge>
                ) : (
                  <NotificationsRoundedIcon />
                )}
              </span>
            }
            value="alerts"
          />
        )}
        <BottomNavigationAction
          className={classes.action}
          label={t('shellMore')}
          aria-haspopup="dialog"
          icon={
            <span className="vf-tab-indicator">
              <MoreHorizRoundedIcon />
            </span>
          }
          value="more"
        />
      </BottomNavigation>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
};

export default MobileTabs;

import { useSelector } from 'react-redux';
import { Badge, IconButton, Tooltip } from '@mui/material';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useTranslation } from '../LocalizationProvider';
import { useShell } from './ShellContext';
import { unreadCount } from '../../util/eventSeverity';

// The bell counts what arrived since the alerts list was last opened (plus open fleet alerts),
// so the number goes down once they have been seen.
const NotificationsButton = () => {
  const t = useTranslation();
  const { openEvents } = useShell();
  const unread = useSelector((state) => unreadCount(state.events.items, state.events.lastSeen));
  const fleetAlerts = useSelector((state) => state.fleet.alertsCount);
  const count = unread + fleetAlerts;
  const label = count
    ? `${t('sharedNotifications')} (${t('eventUnreadCount').replace('{0}', count)})`
    : t('sharedNotifications');

  return (
    <Tooltip title={t('sharedNotifications')}>
      <IconButton onClick={openEvents} aria-label={label}>
        {/* The count is in the label. The badge is drawn only while there is one: MUI keeps
            the last number in a scaled-away badge, and that text would contradict the label. */}
        {count ? (
          <Badge badgeContent={count} max={99} color="error">
            <NotificationsRoundedIcon />
          </Badge>
        ) : (
          <NotificationsRoundedIcon />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default NotificationsButton;

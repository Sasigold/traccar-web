import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { BADGE_BUMP, beat } from '../../theme/motion';
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
  // BRD-03: the badge bumps once (1, 1.15, 1 over 180ms) when the count goes up.
  const badgeRef = useRef(null);
  const previousRef = useRef(count);
  useEffect(() => {
    if (count > previousRef.current) {
      beat(badgeRef.current?.querySelector('.MuiBadge-badge'), BADGE_BUMP, 180);
    }
    previousRef.current = count;
  }, [count]);
  const label = count
    ? `${t('sharedNotifications')} (${t('eventUnreadCount').replace('{0}', count)})`
    : t('sharedNotifications');

  return (
    <Tooltip title={t('sharedNotifications')}>
      <IconButton onClick={openEvents} aria-label={label}>
        {/* The count is in the label. The badge is drawn only while there is one: MUI keeps
            the last number in a scaled-away badge, and that text would contradict the label. */}
        {count ? (
          <Badge ref={badgeRef} badgeContent={count} max={99} color="error">
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

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from './LocalizationProvider';
import { activityOf, activitySince, formatShortDuration } from '../util/activity';
import { formatTime } from '../util/formatter';
import useMinuteNow from '../util/useMinuteNow';
import { useHiddenReason } from '../fleet/usePrivacy';

dayjs.extend(relativeTime);

// The same words wherever a vehicle's state is shown (list row, card): "בתנועה", "בסרק 12 דק׳",
// "עומד 23 דק׳", "אין GPS עדכני · 14:02", "מנותק · לפני 3 שעות". `tone` names a colour role.
export default (device, position) => {
  const t = useTranslation();
  const now = useMinuteNow();
  // A vehicle whose location is hidden is not "offline": say why instead (ISR-03).
  const hidden = useHiddenReason(device?.id);
  if (hidden) {
    return {
      activity: 'hidden',
      label: t(hidden === 'private' ? 'privacyActivityPrivate' : 'privacyActivityHours'),
      tone: 'neutralText',
    };
  }
  const activity = activityOf(device, position, now);
  const since = activitySince(device, activity);
  const duration = since ? formatShortDuration(now - since, t) : '';
  const withDuration = (label) => [label, duration].filter(Boolean).join(' ');
  switch (activity) {
    case 'moving':
      return { activity, label: t('activityMoving'), tone: 'success' };
    case 'idling':
      return { activity, label: withDuration(t('activityIdling')), tone: 'warning' };
    case 'stopped':
      return { activity, label: withDuration(t('activityStopped')), tone: 'neutralText' };
    case 'stale':
      return {
        activity,
        label: `${t('activityStale')} · ${formatTime(position.fixTime, 'minutes').split(' ').pop()}`,
        tone: 'warning',
      };
    default:
      return device?.lastUpdate
        ? {
            activity,
            label: `${t('activityOffline')} · ${dayjs(device.lastUpdate).fromNow()}`,
            tone: 'error',
          }
        : { activity, label: t('activityUnknown'), tone: 'neutralText' };
  }
};

// The color of an activity tone, for its dot or icon (never for the words themselves).
export const toneColor = (theme, tone) => {
  switch (tone) {
    case 'success':
      return theme.palette.success.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    default:
      return theme.palette.neutral.main;
  }
};

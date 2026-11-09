import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from './LocalizationProvider';
import { activityOf, activitySince, formatShortDuration } from '../util/activity';
import { formatTime } from '../util/formatter';
import useMinuteNow from '../util/useMinuteNow';

dayjs.extend(relativeTime);

// The same words wherever a vehicle's state is shown (list row, card): "בתנועה", "בסרק 12 דק׳",
// "עומד 23 דק׳", "אין GPS עדכני · 14:02", "מנותק · לפני 3 שעות". `tone` names a colour role.
export default (device, position) => {
  const t = useTranslation();
  const now = useMinuteNow();
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

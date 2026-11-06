import { Chip, Tooltip } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { daysUntilDate, expiryStatus } from '../../common/fleet/fleetFields';

const chipColor = { expired: 'error', expiring: 'warning', valid: 'success', none: 'default' };

export const statusLabelKey = {
  expired: 'fleetStatusExpired',
  expiring: 'fleetStatusExpiring',
  valid: 'fleetStatusValid',
  none: 'fleetStatusNoExpiry',
};

export const useDaysText = () => {
  const t = useTranslation();
  return (days) => {
    if (days == null) {
      return '';
    }
    if (days < 0) {
      return t('fleetDaysOverdue').replace('{0}', String(-days));
    }
    return t('fleetDaysLeft').replace('{0}', String(days));
  };
};

// Status chip for a single `YYYY-MM-DD` date, or for a precomputed status (several dates).
const ExpiryBadge = ({ date, status: givenStatus, showDays = false }) => {
  const t = useTranslation();
  const daysText = useDaysText();
  const status = givenStatus || expiryStatus(date);
  const days = date ? daysUntilDate(date) : null;
  const detail = daysText(days);
  const label = showDays && detail && status !== 'valid' ? detail : t(statusLabelKey[status]);
  return (
    <Tooltip title={detail}>
      <Chip
        size="small"
        color={chipColor[status]}
        variant={status === 'none' ? 'outlined' : 'filled'}
        label={label}
      />
    </Tooltip>
  );
};

export default ExpiryBadge;

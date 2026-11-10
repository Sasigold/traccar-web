import { Chip, Tooltip } from '@mui/material';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { newDriverStatus } from '../../common/fleet/newDriver';

// ISR-12: "new driver" next to a driver's name, with the escort period while it applies.
const NewDriverChip = ({ issued, size = 'small' }) => {
  const t = useTranslation();
  const status = newDriverStatus(issued);
  if (!status) return null;
  const details = [t('newDriverUntil').replace('{0}', formatTime(status.until, 'date'))];
  if (status.escortDay) details.push(t('newDriverEscortDay'));
  else if (status.escortNight) details.push(t('newDriverEscortNight'));
  return (
    <Tooltip title={details.join(' · ')}>
      <Chip
        size={size}
        color="warning"
        variant="outlined"
        icon={<SchoolRoundedIcon />}
        label={status.escortDay || status.escortNight ? t('newDriverEscort') : t('newDriver')}
        aria-label={`${t('newDriver')}: ${details.join(', ')}`}
      />
    </Tooltip>
  );
};

export default NewDriverChip;

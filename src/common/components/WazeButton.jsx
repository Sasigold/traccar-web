import { IconButton, Tooltip } from '@mui/material';
import DirectionsRoundedIcon from '@mui/icons-material/DirectionsRounded';
import { useTranslation } from './LocalizationProvider';
import { wazeUrl } from '../util/waze';

// ISR-14: a small "navigate with Waze" button for any row that has a place. Renders nothing
// without coordinates or an address.
const WazeButton = ({ place, label, size = 'small' }) => {
  const t = useTranslation();
  const href = wazeUrl(place);
  if (!href) return null;
  const title = label ? `${t('sharedNavigateWaze')}: ${label}` : t('sharedNavigateWaze');
  return (
    <Tooltip title={t('sharedNavigateWaze')}>
      <IconButton
        size={size}
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title}
      >
        <DirectionsRoundedIcon fontSize={size === 'small' ? 'small' : 'medium'} />
      </IconButton>
    </Tooltip>
  );
};

export default WazeButton;

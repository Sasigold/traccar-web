import { Chip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '../LocalizationProvider';
import { appEnvironment } from '../../fleet/config';

const LABELS = {
  staging: ['shellEnvStaging', 'shellEnvStagingShort'],
  development: ['shellEnvDevelopment', 'shellEnvDevelopmentShort'],
};

// FND-04: staging and development say so in the top bar, so nobody mistakes them for the real
// system. Production and the demo show nothing. Phones get the short word, so the logo keeps its
// full width.
const EnvironmentBadge = ({ environment = appEnvironment }) => {
  const t = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const keys = LABELS[environment];
  if (!keys) {
    return null;
  }
  return (
    <Chip
      size="small"
      color="warning"
      label={t(keys[narrow ? 1 : 0])}
      aria-label={t(keys[0])}
      sx={{ fontWeight: 600, flexShrink: 0 }}
    />
  );
};

export default EnvironmentBadge;

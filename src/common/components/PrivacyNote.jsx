import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useTranslation } from './LocalizationProvider';
import { useAttributePreference } from '../util/preferences';
import { formatDistance } from '../util/formatter';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
  },
  padded: {
    padding: theme.spacing(1, 2),
  },
  icon: {
    fontSize: 18,
    flexShrink: 0,
  },
}));

// "Some locations were hidden by the privacy policy" under a replay or a report (ISR-03).
// `kind`: positions, report rows or route lines. `distance` (meters) is shown when it is known.
const PrivacyNote = ({ hidden, distance, kind = 'positions', padded, className }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  if (!hidden) {
    return null;
  }
  const key = {
    positions: 'privacyHiddenPositions',
    rows: 'privacyHiddenRows',
    routes: 'privacyHiddenRoutes',
  };
  const text = t(key[kind]).replace('{0}', hidden);
  return (
    <Typography
      variant="caption"
      className={cx(classes.root, padded && classes.padded, className)}
      role="note"
    >
      <VisibilityOffRoundedIcon className={classes.icon} />
      {distance > 0 ? `${text} · ${formatDistance(distance, distanceUnit, t)}` : text}
    </Typography>
  );
};

export default PrivacyNote;

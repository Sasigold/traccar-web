import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { map } from '../map/core/MapView';
import { useTranslation } from '../common/components/LocalizationProvider';
import { capitalize } from '../common/util/stringUtils';
import { statusColor } from '../common/theme/surfaces';

const useStyles = makeStyles()((theme) => ({
  card: {
    position: 'fixed',
    zIndex: theme.zIndex.tooltip,
    pointerEvents: 'none',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.lg,
    minWidth: 160,
    transform: 'translate(-50%, calc(-100% - 24px))',
    boxShadow: theme.shadows[4],
  },
  name: {
    fontWeight: 600,
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
}));

// LIV-12: a short hover on a vehicle on the map shows who it is: name, plate, status and when
// it last reported, without selecting it.
const MapHoverCard = ({ hover }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const device = useSelector((state) => (hover ? state.devices.items[hover.deviceId] : null));
  if (!hover || !device) return null;
  const rect = map.getCanvas().getBoundingClientRect();
  const plate = device.attributes?.plateNumber;
  return (
    <Paper
      className={classes.card}
      role="tooltip"
      style={{ left: rect.left + hover.x, top: rect.top + hover.y }}
    >
      <Typography variant="body2" className={classes.name}>
        {device.name}
      </Typography>
      {plate && (
        <Typography variant="caption" className={classes.line} component="div" dir="ltr">
          {plate}
        </Typography>
      )}
      <Typography variant="caption" className={classes.line} component="div">
        <span
          className={classes.dot}
          style={{ backgroundColor: statusColor(theme, device.status) }}
        />
        {t(`deviceStatus${capitalize(device.status || 'unknown')}`)}
        {device.lastUpdate && ` · ${dayjs(device.lastUpdate).fromNow()}`}
      </Typography>
    </Paper>
  );
};

export default MapHoverCard;

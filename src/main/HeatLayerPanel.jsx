import { useState } from 'react';
import {
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import { HEATMAP_KINDS } from '../reports/common/heatmapPoints';
import loadHeatPoints from '../reports/common/heatmapLoad';
import { capitalize } from '../common/util/stringUtils';
import { formatGrouped } from '../common/util/formatter';

export const HEAT_PERIODS = [1, 7, 30];

const useStyles = makeStyles()((theme) => ({
  panel: {
    position: 'absolute',
    top: theme.spacing(2),
    insetInline: 0,
    marginInline: 'auto',
    width: 'fit-content',
    maxWidth: `calc(100% - ${theme.spacing(4)})`,
    zIndex: 3,
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    boxShadow: theme.shadows[3],
    [theme.breakpoints.down('md')]: {
      top: theme.spacing(9),
    },
  },
  progress: {
    position: 'absolute',
    insetInline: theme.spacing(2),
    bottom: 0,
  },
}));

// LIV-27: the density map as a layer of the live map: what (stops, idling, harsh driving,
// speeding) and over which period, for the vehicles the list shows.
const HeatLayerPanel = ({ deviceIds, onPoints, onClose, startPadding = 0 }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [kind, setKind] = useState('stops');
  const [days, setDays] = useState(7);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);

  useAsyncTask(
    async ({ signal }) => {
      if (!deviceIds.length) {
        onPoints([]);
        setCount(0);
        return;
      }
      const to = new Date();
      const from = new Date(to.getTime() - days * 86400000);
      setLoading(true);
      try {
        const points = await loadHeatPoints({
          kind,
          deviceIds,
          from: from.toISOString(),
          to: to.toISOString(),
          signal,
        });
        onPoints(points);
        setCount(points.length);
      } finally {
        setLoading(false);
      }
    },
    [kind, days, deviceIds, onPoints],
  );

  return (
    <Paper
      className={classes.panel}
      role="region"
      aria-label={t('heatLayerTitle')}
      style={{ insetInlineStart: startPadding }}
    >
      <TextField
        select
        size="small"
        label={t('reportHeatmapKind')}
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        sx={{ minWidth: 150 }}
      >
        {HEATMAP_KINDS.map((value) => (
          <MenuItem key={value} value={value}>
            {t(`reportHeatmap${capitalize(value)}`)}
          </MenuItem>
        ))}
      </TextField>
      {HEAT_PERIODS.map((value) => (
        <Chip
          key={value}
          label={t(value === 1 ? 'heatLayerToday' : 'heatLayerDays').replace('{0}', String(value))}
          color={days === value ? 'primary' : 'default'}
          variant={days === value ? 'filled' : 'outlined'}
          aria-pressed={days === value}
          onClick={() => setDays(value)}
        />
      ))}
      <Typography variant="body2" role="status" sx={{ minWidth: 72 }}>
        {count == null ? '' : t('heatLayerCount').replace('{0}', formatGrouped(count, 0))}
      </Typography>
      <Tooltip title={t('sharedHide')}>
        <IconButton size="small" aria-label={t('heatLayerClose')} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Tooltip>
      {loading && <LinearProgress className={classes.progress} />}
    </Paper>
  );
};

export default HeatLayerPanel;

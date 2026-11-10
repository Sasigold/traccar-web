import { useState } from 'react';
import { Button, Chip, IconButton, Paper, Slider, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { RANGE_HOURS, STEP_MINUTES, momentOf, positionsAt, rewindWindow } from './rewind';

const useStyles = makeStyles()((theme) => ({
  // Full width and centred, so it sits in the middle of the map in either direction.
  dock: {
    position: 'absolute',
    insetInline: 0,
    // Above the map's scale and attribution.
    bottom: theme.spacing(7),
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 3,
    [theme.breakpoints.down('md')]: {
      bottom: theme.spacing(10),
    },
  },
  bar: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.tokens.radius.pill,
    width: 'min(560px, calc(100% - 32px))',
    boxShadow: theme.shadows[3],
  },
  slider: {
    flex: 1,
    minWidth: 120,
  },
  time: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  toggle: {
    pointerEvents: 'auto',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[3],
    '&:hover': { backgroundColor: theme.palette.background.paper },
  },
}));

const RANGE = RANGE_HOURS * 60;

// LIV-26: drag back along the last day and see the whole fleet as it was then ("where was
// everyone at 10:00?"). Each release asks only for a short window before that moment; "Live"
// brings the map back. onRewind(positions, time) or onRewind(null) for live.
const FleetRewindBar = ({ deviceIds, onRewind, startPadding = 0 }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  // Minutes from the start of the range: RANGE is now.
  const [value, setValue] = useState(RANGE);
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(false);

  const show = useCatch(async (minutes) => {
    if (minutes >= RANGE) {
      setMoment(null);
      onRewind(null);
      return;
    }
    const time = momentOf(RANGE - minutes);
    const { from, to } = rewindWindow(time);
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((id) => query.append('deviceId', id));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`api/reports/route?${query}`, {
        headers: { Accept: 'application/json' },
      });
      setMoment(time);
      onRewind(positionsAt(await response.json(), time), time);
    } finally {
      setLoading(false);
    }
  });

  const live = () => {
    setValue(RANGE);
    setMoment(null);
    onRewind(null);
  };

  if (!open) {
    return (
      <div className={classes.dock} style={{ paddingInlineStart: startPadding }}>
        <Tooltip title={t('rewindOpen')}>
          <IconButton
            className={classes.toggle}
            aria-label={t('rewindOpen')}
            onClick={() => setOpen(true)}
          >
            <HistoryRoundedIcon />
          </IconButton>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={classes.dock} style={{ paddingInlineStart: startPadding }}>
      <Paper className={classes.bar} role="group" aria-label={t('rewindTitle')}>
        <HistoryRoundedIcon color="primary" />
        <Slider
          className={classes.slider}
          size="small"
          min={0}
          max={RANGE}
          step={STEP_MINUTES}
          value={value}
          disabled={loading}
          onChange={(_, next) => setValue(next)}
          onChangeCommitted={(_, next) => show(next)}
          getAriaValueText={(minutes) =>
            minutes >= RANGE ? t('rewindLive') : formatTime(momentOf(RANGE - minutes), 'minutes')
          }
          valueLabelDisplay="auto"
          valueLabelFormat={(minutes) =>
            minutes >= RANGE ? t('rewindLive') : formatTime(momentOf(RANGE - minutes), 'minutes')
          }
          aria-label={t('rewindTitle')}
        />
        {moment ? (
          <>
            <Typography variant="body2" className={classes.time} role="status">
              {formatTime(moment, 'minutes')}
            </Typography>
            <Button size="small" variant="contained" onClick={live}>
              {t('rewindLive')}
            </Button>
          </>
        ) : (
          <Chip size="small" color="success" label={t('rewindLive')} />
        )}
        <Button
          size="small"
          onClick={() => {
            live();
            setOpen(false);
          }}
        >
          {t('sharedHide')}
        </Button>
      </Paper>
    </div>
  );
};

export default FleetRewindBar;

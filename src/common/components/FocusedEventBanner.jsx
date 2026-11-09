import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { devicesActions, eventsActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useAttributePreference } from '../util/preferences';
import { eventSeverity, eventTime } from '../util/eventSeverity';
import { formatNotificationTitle, formatSpeed } from '../util/formatter';
import { formatShortDuration } from '../util/activity';
import useMinuteNow from '../util/useMinuteNow';

// Replay window around an alert.
const AROUND_MS = 15 * 60 * 1000;

const useStyles = makeStyles()((theme) => ({
  root: {
    margin: theme.spacing(0, 2, 1),
    padding: theme.spacing(1, 1, 1, 1.25),
    borderRadius: theme.tokens.radius.md,
    borderInlineStart: `3px solid ${theme.palette.primary.main}`,
    backgroundColor: theme.palette.surface.sunken,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  critical: {
    borderInlineStartColor: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
  },
  warning: {
    borderInlineStartColor: theme.palette.warning.main,
    backgroundColor: alpha(theme.palette.warning.main, 0.12),
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    paddingTop: 2,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

// The alert opened from the alerts list, on the card of its vehicle: what, how fast, when; where
// it happened, and a replay of the 15 minutes before and after.
const FocusedEventBanner = ({ deviceId }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const now = useMinuteNow();
  const speedUnit = useAttributePreference('speedUnit');
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');
  const soundEvents = useAttributePreference('soundEvents', '');
  const event = useSelector((state) => state.events.focused);

  if (!event || event.deviceId !== deviceId) {
    return null;
  }

  const time = eventTime(event);
  const severity = eventSeverity(event, { soundAlarms, soundEvents });
  const title = formatNotificationTitle(t, {
    type: event.type,
    attributes: { alarms: event.attributes?.alarm },
  });
  const speed = event.attributes?.speed;
  const ago = t('eventAgo').replace('{0}', formatShortDuration(Math.max(0, now - time), t));

  const replay = () => {
    const query = new URLSearchParams({
      deviceId,
      from: new Date(time - AROUND_MS).toISOString(),
      to: new Date(time + AROUND_MS).toISOString(),
    });
    navigate(`/replay?${query.toString()}`);
  };

  return (
    <div className={cx(classes.root, classes[severity])} role="status">
      <div className={classes.head}>
        <span className={classes.text}>
          {[title, speed != null ? formatSpeed(speed, speedUnit, t) : null, ago]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <IconButton
          size="small"
          aria-label={t('eventHide')}
          onClick={() => dispatch(eventsActions.focus(null))}
        >
          <CloseRoundedIcon fontSize="inherit" />
        </IconButton>
      </div>
      <div className={classes.actions}>
        {event.positionId ? (
          <Button
            size="small"
            startIcon={<PlaceRoundedIcon />}
            onClick={() => {
              dispatch(devicesActions.releaseFollow());
              dispatch(eventsActions.locate());
            }}
          >
            {t('eventLocation')}
          </Button>
        ) : null}
        {time > 0 && (
          <Button size="small" startIcon={<HistoryRoundedIcon />} onClick={replay}>
            {t('eventReplayAround')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FocusedEventBanner;

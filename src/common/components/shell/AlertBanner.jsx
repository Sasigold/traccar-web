import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { devicesActions, eventsActions } from '../../../store';
import { useTranslation } from '../LocalizationProvider';
import { useAttributePreference } from '../../util/preferences';
import { eventSeverity, eventTime } from '../../util/eventSeverity';
import { formatNotificationTitle } from '../../util/formatter';
import { formatShortDuration } from '../../util/activity';
import useMinuteNow from '../../util/useMinuteNow';
import { enableSound, useSoundBlocked } from '../../util/alarmSound';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'fixed',
    zIndex: theme.layers.alert,
    top: `calc(var(--shell-top, 0px) + ${theme.spacing(1.5)} + env(safe-area-inset-top, 0px))`,
    insetInlineStart: 'var(--shell-rail, 0px)',
    insetInlineEnd: 0,
    display: 'flex',
    justifyContent: 'center',
    paddingInline: theme.spacing(2),
    pointerEvents: 'none',
  },
  banner: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1, 1.5),
    maxWidth: 720,
    padding: theme.spacing(1.25, 1.5, 1.25, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    boxShadow: theme.shadows[6],
  },
  text: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: '1 1 240px',
    minWidth: 0,
    fontWeight: 600,
    fontSize: '0.9375rem',
  },
  more: {
    fontWeight: 500,
    opacity: 0.9,
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginInlineStart: 'auto',
  },
  action: {
    '&&': {
      color: 'inherit',
      backgroundColor: 'transparent',
      borderColor: alpha(theme.palette.error.contrastText, 0.6),
      whiteSpace: 'nowrap',
    },
    '&&:hover': {
      borderColor: theme.palette.error.contrastText,
      backgroundColor: alpha(theme.palette.error.contrastText, 0.12),
    },
  },
  acknowledge: {
    '&&': {
      backgroundColor: theme.palette.error.contrastText,
      color: theme.palette.error.main,
      whiteSpace: 'nowrap',
    },
    '&&:hover': {
      backgroundColor: alpha(theme.palette.error.contrastText, 0.88),
    },
  },
}));

// Critical events (SOS, accident, tampering, and the alarm types chosen to sound) stay at the
// top of every screen until someone acknowledges them. Read out at once (role="alert").
const AlertBanner = ({ endInset = 0 }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const now = useMinuteNow();
  const soundBlocked = useSoundBlocked();

  const soundAlarms = useAttributePreference('soundAlarms', 'sos');
  const soundEvents = useAttributePreference('soundEvents', '');
  const events = useSelector((state) => state.events.items);
  const acknowledged = useSelector((state) => state.events.acknowledged);
  const devices = useSelector((state) => state.devices.items);

  const done = new Set(acknowledged);
  const open = events.filter(
    (event) =>
      !done.has(event.id) && eventSeverity(event, { soundAlarms, soundEvents }) === 'critical',
  );
  if (!open.length) {
    return null;
  }
  const [latest] = open;
  const title = formatNotificationTitle(t, {
    type: latest.type,
    attributes: { alarms: latest.attributes?.alarm },
  });
  const ago = t('eventAgo').replace(
    '{0}',
    formatShortDuration(Math.max(0, now - eventTime(latest)), t),
  );

  return (
    <div className={classes.root} style={endInset ? { insetInlineEnd: endInset } : undefined}>
      <div className={classes.banner} role="alert">
        <span className={classes.text}>
          <ReportRoundedIcon aria-hidden />
          <span>
            {[title, devices[latest.deviceId]?.name, ago].filter(Boolean).join(' · ')}
            {open.length > 1 && (
              <span className={classes.more}>
                {' '}
                {t('eventMoreCount').replace('{0}', open.length - 1)}
              </span>
            )}
          </span>
        </span>
        <span className={classes.actions}>
          {soundBlocked && (
            <Button
              size="small"
              variant="outlined"
              className={classes.action}
              startIcon={<VolumeUpRoundedIcon />}
              onClick={enableSound}
            >
              {t('eventEnableSound')}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            className={classes.action}
            onClick={() => {
              dispatch(eventsActions.focus(latest));
              dispatch(devicesActions.selectId(latest.deviceId));
              navigate('/');
            }}
          >
            {t('eventShowOnMap')}
          </Button>
          <Button
            size="small"
            variant="contained"
            className={classes.acknowledge}
            onClick={() => dispatch(eventsActions.acknowledge(latest.id))}
          >
            {t('eventAcknowledge')}
          </Button>
        </span>
      </div>
    </div>
  );
};

export default AlertBanner;

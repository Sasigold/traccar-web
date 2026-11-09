import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { ButtonBase, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { useTranslation } from '../LocalizationProvider';
import { formatTime } from '../../util/formatter';

// No message for this long while connected: the data may be stale.
export const QUIET_AFTER_MS = 2 * 60 * 1000;
export const RECONNECT_NOW_EVENT = 'vf-reconnect-now';

// One ring per received message (keyed by its time), so the dot only moves when data arrives.
const ping = keyframes`
  0% { box-shadow: 0 0 0 0 currentColor; }
  100% { box-shadow: 0 0 0 7px transparent; }
`;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    height: 30,
    padding: theme.spacing(0, 1.25),
    borderRadius: theme.tokens.radius.pill,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    border: '1px solid',
    fontFamily: 'inherit',
    [theme.breakpoints.down('md')]: {
      paddingInline: theme.spacing(0.875),
    },
  },
  label: {
    color: theme.palette.text.primary,
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  time: {
    fontVariantNumeric: 'tabular-nums',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  dotPing: {
    animation: `${ping} 600ms ${theme.tokens.motion.easing.standard} 1`,
  },
}));

const useNow = (interval) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
};

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

const SocketStatusPill = () => {
  const { classes, cx, theme } = useStyles();
  const t = useTranslation();

  const socket = useSelector((state) => state.session.socket);
  const lastMessageAt = useSelector((state) => state.session.lastMessageAt);
  const reconnectAt = useSelector((state) => state.session.reconnectAt);
  const online = useOnline();
  const now = useNow(socket === false ? 1000 : 15000);

  if (socket == null) {
    return null;
  }

  const time = lastMessageAt ? formatTime(lastMessageAt, 'minutes').split(' ').pop() : '';
  let state;
  if (!online) {
    state = 'offline';
  } else if (socket === false) {
    state = 'disconnected';
  } else if (lastMessageAt && now - lastMessageAt > QUIET_AFTER_MS) {
    state = 'quiet';
  } else {
    state = 'live';
  }

  const seconds = reconnectAt ? Math.max(0, Math.ceil((reconnectAt - now) / 1000)) : 0;
  const label = {
    live: time ? t('mapSynced').replace('{0}', time) : t('mapLive'),
    quiet: t('mapQuiet').replace('{0}', time),
    disconnected: seconds ? t('mapRetryIn').replace('{0}', seconds) : t('mapRetrying'),
    offline: t('mapOffline'),
  }[state];
  const tooltip = {
    live: label,
    quiet: `${label} · ${t('mapQuietHint')}`,
    disconnected: `${label} · ${t('mapRetryNow')}`,
    offline: label,
  }[state];
  const color = {
    live: theme.palette.success.main,
    quiet: theme.palette.warning.main,
    disconnected: theme.palette.warning.main,
    offline: theme.palette.error.main,
  }[state];

  const style = {
    color,
    backgroundColor: alpha(color, 0.1),
    borderColor: alpha(color, 0.28),
  };
  const content = (
    <>
      <span
        key={state === 'live' ? lastMessageAt : state}
        className={cx(classes.dot, state === 'live' && classes.dotPing)}
      />
      <span className={cx(classes.label, classes.time)}>{label}</span>
    </>
  );

  return (
    <Tooltip title={tooltip}>
      {state === 'disconnected' ? (
        <ButtonBase
          className={classes.root}
          style={style}
          aria-label={tooltip}
          onClick={() => window.dispatchEvent(new Event(RECONNECT_NOW_EVENT))}
        >
          {content}
        </ButtonBase>
      ) : (
        <span role="status" aria-label={tooltip} className={classes.root} style={style}>
          {content}
        </span>
      )}
    </Tooltip>
  );
};

export default SocketStatusPill;

import { useSelector } from 'react-redux';
import { Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { useTranslation } from '../LocalizationProvider';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 currentColor; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
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
  },
  label: {
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  compact: {
    [theme.breakpoints.down('md')]: {
      paddingInline: theme.spacing(0.875),
    },
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  dotLive: {
    animation: `${pulse} 2s ease-out infinite`,
  },
}));

const SocketStatusPill = () => {
  const { classes, cx, theme } = useStyles();
  const t = useTranslation();

  const socket = useSelector((state) => state.session.socket);

  if (socket == null) {
    return null;
  }

  const live = socket === true;
  const color = live ? theme.palette.success.main : theme.palette.warning.main;
  const label = live ? t('mapLive') : t('mapReconnecting');

  return (
    <Tooltip title={label}>
      <Typography
        component="span"
        className={cx(classes.root, classes.compact)}
        style={{
          color,
          backgroundColor: alpha(color, 0.1),
          borderColor: alpha(color, 0.28),
        }}
      >
        <span className={cx(classes.dot, live && classes.dotLive)} />
        <span className={classes.label}>{label}</span>
      </Typography>
    </Tooltip>
  );
};

export default SocketStatusPill;

import { useSelector } from 'react-redux';
import { Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import Logo from '../../resources/images/logo.svg?react';
import { useTranslation } from '../../common/components/LocalizationProvider';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 currentColor; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 2, 0.5),
  },
  logo: {
    height: 34,
    width: 'auto',
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  logoImage: {
    maxHeight: 34,
    maxWidth: 160,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    border: '1px solid',
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

const MainHeader = () => {
  const { classes, cx, theme } = useStyles();
  const t = useTranslation();

  const socket = useSelector((state) => state.session.socket);
  const logo = useSelector((state) => state.session.server.attributes?.logo);

  const live = socket === true;
  const color = live ? theme.palette.success.main : theme.palette.warning.main;

  return (
    <div className={classes.root}>
      {logo ? (
        <img className={classes.logoImage} src={logo} alt="" />
      ) : (
        <Logo className={classes.logo} />
      )}
      <Typography
        component="span"
        className={classes.status}
        style={{
          color,
          backgroundColor: alpha(color, 0.1),
          borderColor: alpha(color, 0.28),
        }}
      >
        <span className={cx(classes.dot, live && classes.dotLive)} />
        {live ? t('mapLive') : t('mapReconnecting')}
      </Typography>
    </div>
  );
};

export default MainHeader;

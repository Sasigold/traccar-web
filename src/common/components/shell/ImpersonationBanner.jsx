import { useSelector } from 'react-redux';
import { Button, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SupervisorAccountRoundedIcon from '@mui/icons-material/SupervisorAccountRounded';
import { useTranslation } from '../LocalizationProvider';
import useLogout from '../../util/useLogout';
import { currentImpersonation, endImpersonation } from '../../util/impersonation';
import { useCatch } from '../../../reactHelper';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 2),
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    flexShrink: 0,
    zIndex: theme.layers.topBar,
    '@media print': {
      display: 'none',
    },
  },
  text: {
    flex: 1,
    fontWeight: 600,
  },
}));

// SEC-13: while logged in as someone else, it says so on every screen, with the way back.
const ImpersonationBanner = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const user = useSelector((state) => state.session.user);
  const logout = useLogout();
  const current = user ? currentImpersonation(user.id) : null;
  const back = useCatch(() => endImpersonation(current, logout));
  if (!current) return null;
  return (
    <div className={classes.root} role="status">
      <SupervisorAccountRoundedIcon fontSize="small" />
      <Typography variant="body2" className={classes.text}>
        {t('impersonateBanner').replace('{0}', current.targetName).replace('{1}', current.byName)}
      </Typography>
      <Button size="small" color="inherit" variant="outlined" onClick={back}>
        {t('impersonateBack')}
      </Button>
    </div>
  );
};

export default ImpersonationBanner;

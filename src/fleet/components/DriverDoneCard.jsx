import { Button, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Link as RouterLink } from 'react-router-dom';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';

const useStyles = makeStyles()((theme) => ({
  card: {
    margin: theme.spacing(2, 'auto'),
    width: '100%',
    maxWidth: 480,
    boxSizing: 'border-box',
    padding: theme.spacing(4, 3),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    textAlign: 'center',
  },
  icon: {
    fontSize: 64,
    color: theme.palette.success.main,
  },
  action: {
    minHeight: 56,
    alignSelf: 'stretch',
  },
}));

// After a driver sends a check or a report (ADM-09): what was sent and when, and one main
// action, back to the driver area.
const DriverDoneCard = ({ titleKey, time, children }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <Paper elevation={0} className={classes.card} role="status">
      <CheckCircleRoundedIcon className={classes.icon} />
      <Typography variant="h6" component="h2">
        {t(titleKey).replace('{0}', formatTime(time, 'clock'))}
      </Typography>
      {children}
      <Button variant="contained" component={RouterLink} to="/driver" className={classes.action}>
        {t('driverBackToArea')}
      </Button>
    </Paper>
  );
};

export default DriverDoneCard;

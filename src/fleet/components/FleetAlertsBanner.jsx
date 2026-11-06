import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { ButtonBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 2, 1.5),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontSize: '0.8125rem',
    border: '1px solid transparent',
    '&:hover, &:focus-visible': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
  },
  icon: {
    fontSize: 20,
    color: theme.palette.error.main,
  },
}));

// Open fleet alerts at the top of the events drawer; hidden when there are none.
const FleetAlertsBanner = ({ onNavigate }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const count = useSelector((state) => state.fleet.alertsCount);
  if (!count) {
    return null;
  }
  return (
    <ButtonBase
      component={RouterLink}
      to="/fleet/alerts"
      className={classes.root}
      onClick={onNavigate}
    >
      <EventBusyRoundedIcon className={classes.icon} />
      {t('fleetAlertsOpenCount').replace('{0}', String(count))}
    </ButtonBase>
  );
};

export default FleetAlertsBanner;

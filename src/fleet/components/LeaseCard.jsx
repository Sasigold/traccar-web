import { Alert, LinearProgress, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { leaseForecast } from '../../common/fleet/lease';
import { odometerKm } from '../../common/fleet/workOrders';
import { formatDays } from '../../common/util/plural';
import { money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  panel: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& > svg': { color: theme.palette.primary.main },
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  facts: {
    display: 'flex',
    gap: theme.spacing(0.5, 3),
    flexWrap: 'wrap',
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
  },
}));

// ADM-31: a leased vehicle's kilometers against the contract's quota, and the overage the current
// pace leads to. Shown once the contract's dates and quota are filled in.
const LeaseCard = ({ device, position }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const attributes = device?.attributes || {};
  if (attributes.ownership !== 'leased') return null;
  const forecast = leaseForecast(attributes, odometerKm(position));
  if (!forecast) return null;
  const { used, quota, share, expected, projected, excessKm, excessCost, daysLeft } = forecast;
  const kmText = (value) => `${Math.round(value).toLocaleString('en-US')} ${t('sharedKm')}`;
  const over = excessKm > 0;

  return (
    <Paper elevation={0} className={classes.panel} component="section" aria-label={t('leaseTitle')}>
      <div className={classes.head}>
        <HandshakeRoundedIcon fontSize="small" />
        <Typography variant="subtitle1" component="h3">
          {t('leaseTitle')}
        </Typography>
      </div>
      <Typography>
        {t('leaseUsed').replace('{0}', kmText(used)).replace('{1}', kmText(quota))}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={share * 100}
        color={over ? 'warning' : 'primary'}
        className={classes.bar}
        aria-label={t('leaseTitle')}
      />
      <div className={classes.facts}>
        <Typography variant="body2">
          {t('leaseExpected').replace('{0}', kmText(expected))}
        </Typography>
        {projected != null && (
          <Typography variant="body2">
            {t('leaseProjected').replace('{0}', kmText(projected))}
          </Typography>
        )}
        <Typography variant="body2">
          {t('leaseDaysLeft').replace('{0}', formatDays(daysLeft, t))}
        </Typography>
      </div>
      {over && (
        <Alert severity="warning">
          {excessCost != null
            ? t('leaseOverCost').replace('{0}', kmText(excessKm)).replace('{1}', money(excessCost))
            : t('leaseOver').replace('{0}', kmText(excessKm))}
        </Alert>
      )}
    </Paper>
  );
};

export default LeaseCard;

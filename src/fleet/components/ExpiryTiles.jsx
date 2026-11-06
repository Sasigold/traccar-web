import { Link as RouterLink } from 'react-router-dom';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { EXPIRY_WINDOW_DAYS } from '../../common/fleet/fleetFields';
import useExpiries from '../useExpiries';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 220px))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'start',
    gap: 2,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    border: '1px solid transparent',
    backgroundColor: theme.palette.surface.tint,
    '&:hover, &:focus-visible': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.2,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  strip: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: `calc(100% - ${theme.spacing(4)})`,
    margin: theme.spacing(0, 2, 1.5),
    padding: theme.spacing(0.75, 1.25),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    fontSize: '0.75rem',
    fontWeight: 600,
    justifyContent: 'flex-start',
    border: '1px solid transparent',
    '&:hover, &:focus-visible': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
    [theme.breakpoints.down('md')]: {
      width: `calc(100% - ${theme.spacing(3)})`,
      marginInline: theme.spacing(1.5),
    },
  },
  stripIcon: {
    fontSize: 18,
  },
  stripPart: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
}));

// Expired / expiring-soon counts linking to the filtered expiries list.
// `compact` is the one-line strip shown above the vehicle list on the map; it hides itself
// when nothing needs attention.
const ExpiryTiles = ({ compact }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const { counts } = useExpiries();

  const tiles = [
    { key: 'expired', color: theme.palette.error.main, label: t('fleetFilterExpired') },
    {
      key: 'expiring',
      color: theme.palette.warning.main,
      label: t('fleetExpiringWithin').replace('{0}', String(EXPIRY_WINDOW_DAYS)),
    },
  ];

  if (compact) {
    if (!counts.expired && !counts.expiring) {
      return null;
    }
    return (
      <ButtonBase
        component={RouterLink}
        to="/fleet/expiries"
        className={classes.strip}
        aria-label={t('fleetExpiriesPage')}
      >
        <EventBusyRoundedIcon className={classes.stripIcon} />
        {tiles
          .filter((tile) => counts[tile.key])
          .map((tile) => (
            <span key={tile.key} className={classes.stripPart}>
              <span className={classes.dot} style={{ backgroundColor: tile.color }} />
              {`${counts[tile.key]} ${tile.label}`}
            </span>
          ))}
      </ButtonBase>
    );
  }

  return (
    <div className={classes.grid}>
      {tiles.map((tile) => (
        <ButtonBase
          key={tile.key}
          component={RouterLink}
          to={`/fleet/expiries?status=${tile.key}`}
          className={classes.tile}
        >
          <span className={classes.label}>
            <span className={classes.dot} style={{ backgroundColor: tile.color }} />
            {tile.label}
          </span>
          <Typography component="span" className={classes.value}>
            {counts[tile.key]}
          </Typography>
        </ButtonBase>
      ))}
    </div>
  );
};

export default ExpiryTiles;

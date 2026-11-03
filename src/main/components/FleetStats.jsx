import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { statusColor } from '../../common/theme/surfaces';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0, 2, 1.5),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 1.5, 1.25),
    },
  },
  tile: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'start',
    gap: 2,
    padding: theme.spacing(1, 1, 1.25),
    borderRadius: theme.tokens.radius.lg,
    overflow: 'hidden',
    border: '1px solid transparent',
    backgroundColor: theme.palette.surface.tint,
    transition: 'border-color 160ms ease, background-color 160ms ease, transform 160ms ease',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
      transform: 'translateY(-1px)',
    },
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    minWidth: 0,
  },
  labelText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  value: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  bar: {
    position: 'absolute',
    insetInlineStart: 0,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    transition: 'width 400ms ease',
  },
}));

const statuses = ['online', 'offline', 'unknown'];

const labelKeys = {
  online: 'deviceStatusOnline',
  offline: 'deviceStatusOffline',
  unknown: 'fleetStatsUnknown',
};

const FleetStats = ({ filter, setFilter }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);

  const counts = useMemo(() => {
    const result = { total: 0, online: 0, offline: 0, unknown: 0 };
    Object.values(devices).forEach((device) => {
      result.total += 1;
      result[statuses.includes(device.status) ? device.status : 'unknown'] += 1;
    });
    return result;
  }, [devices]);

  const toggle = (status) => {
    const selected = filter.statuses.includes(status)
      ? filter.statuses.filter((it) => it !== status)
      : [...filter.statuses, status];
    setFilter({ ...filter, statuses: selected });
  };

  const tileStyle = (active, color) =>
    active
      ? {
          borderColor: alpha(color, 0.6),
          backgroundColor: theme.palette.background.paper,
        }
      : undefined;

  const allActive = !filter.statuses.length;

  return (
    <div className={classes.root}>
      <ButtonBase
        className={classes.tile}
        style={tileStyle(allActive, theme.palette.primary.main)}
        onClick={() => setFilter({ ...filter, statuses: [] })}
        aria-pressed={allActive}
      >
        <span className={classes.label}>
          <span className={classes.dot} style={{ backgroundColor: theme.palette.primary.main }} />
          <span className={classes.labelText}>{t('deviceTitle')}</span>
        </span>
        <Typography component="span" className={classes.value}>
          {counts.total}
        </Typography>
        <span
          className={classes.bar}
          style={{ width: '100%', backgroundColor: theme.palette.primary.main }}
        />
      </ButtonBase>
      {statuses.map((status) => {
        const color = statusColor(theme, status);
        const share = counts.total ? (counts[status] / counts.total) * 100 : 0;
        return (
          <ButtonBase
            key={status}
            className={classes.tile}
            style={tileStyle(filter.statuses.includes(status), color)}
            onClick={() => toggle(status)}
            title={t(labelKeys[status])}
            aria-pressed={filter.statuses.includes(status)}
          >
            <span className={classes.label}>
              <span className={classes.dot} style={{ backgroundColor: color }} />
              <span className={classes.labelText}>{t(labelKeys[status])}</span>
            </span>
            <Typography component="span" className={classes.value}>
              {counts[status]}
            </Typography>
            <span className={classes.bar} style={{ width: `${share}%`, backgroundColor: color }} />
          </ButtonBase>
        );
      })}
    </div>
  );
};

export default FleetStats;

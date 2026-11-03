import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { accentGradient, statusColor } from '../../common/theme/glass';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0, 2, 1.5),
  },
  tile: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'start',
    gap: 2,
    padding: theme.spacing(1, 1.25, 1.25),
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.03 : 0.02),
    transition: 'border-color 160ms ease, background-color 160ms ease, transform 160ms ease',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
      transform: 'translateY(-1px)',
    },
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
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
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  bar: {
    position: 'absolute',
    insetInlineStart: 0,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    transition: 'width 400ms ease',
  },
}));

const statuses = ['online', 'offline', 'unknown'];

const labelKeys = {
  online: 'deviceStatusOnline',
  offline: 'deviceStatusOffline',
  unknown: 'deviceStatusUnknown',
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
          borderColor: alpha(color, 0.55),
          backgroundColor: alpha(color, 0.1),
          boxShadow: `0 0 0 1px ${alpha(color, 0.25)}, 0 6px 18px ${alpha(color, 0.18)}`,
        }
      : undefined;

  const allActive = !filter.statuses.length;

  return (
    <div className={classes.root}>
      <ButtonBase
        className={classes.tile}
        style={tileStyle(allActive, theme.palette.primary.main)}
        onClick={() => setFilter({ ...filter, statuses: [] })}
      >
        <span className={classes.label}>
          <span className={classes.dot} style={{ background: accentGradient(theme) }} />
          <span className={classes.labelText}>{t('deviceTitle')}</span>
        </span>
        <Typography component="span" className={classes.value}>
          {counts.total}
        </Typography>
        <span
          className={classes.bar}
          style={{ width: '100%', background: accentGradient(theme, 90) }}
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
          >
            <span className={classes.label}>
              <span
                className={classes.dot}
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${alpha(color, 0.7)}` }}
              />
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

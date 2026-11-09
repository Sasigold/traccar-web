import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { activityGroup, activityOf } from '../../common/util/activity';
import useMinuteNow from '../../common/util/useMinuteNow';

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
    transition: `border-color ${theme.tokens.motion.duration.base}ms ${theme.tokens.motion.easing.standard}, background-color ${theme.tokens.motion.duration.base}ms ${theme.tokens.motion.easing.standard}`,
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
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
  hint: {
    fontSize: '0.6875rem',
    color: theme.palette.surface.textSecondaryOnTint,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bar: {
    position: 'absolute',
    insetInlineStart: 0,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    transition: `width 400ms ${theme.tokens.motion.easing.standard}`,
  },
}));

// The tiles answer "what is the fleet doing now" (brand mockup p.14: vehicles / moving), and
// filter the list: all, moving, stopped (idling counted inside), not reporting.
const FleetStats = ({ filter, setFilter }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const now = useMinuteNow();

  const counts = useMemo(() => {
    const result = { total: 0, moving: 0, stopped: 0, idling: 0, offline: 0 };
    Object.values(devices).forEach((device) => {
      const activity = activityOf(device, positions[device.id], now);
      result.total += 1;
      result[activityGroup(activity)] += 1;
      if (activity === 'idling') {
        result.idling += 1;
      }
    });
    return result;
  }, [devices, positions, now]);

  const activities = filter.activities || [];
  const toggle = (group) => {
    const selected = activities.includes(group)
      ? activities.filter((it) => it !== group)
      : [...activities, group];
    setFilter({ ...filter, activities: selected });
  };

  const tiles = [
    { key: 'moving', label: t('fleetStatsMoving'), color: theme.palette.success.main },
    {
      key: 'stopped',
      label: t('fleetStatsStopped'),
      color: theme.palette.neutral.main,
      hint: counts.idling ? t('fleetStatsIdlingCount').replace('{0}', counts.idling) : null,
    },
    { key: 'offline', label: t('fleetStatsNotReporting'), color: theme.palette.error.main },
  ];

  const tileStyle = (active, color) =>
    active
      ? { borderColor: alpha(color, 0.6), backgroundColor: theme.palette.background.paper }
      : undefined;

  const allActive = !activities.length;

  return (
    <div className={classes.root}>
      <ButtonBase
        className={classes.tile}
        style={tileStyle(allActive, theme.palette.primary.main)}
        onClick={() => setFilter({ ...filter, activities: [] })}
        aria-pressed={allActive}
      >
        <span className={classes.label}>
          <span className={classes.dot} style={{ backgroundColor: theme.palette.primary.main }} />
          <span className={classes.labelText}>{t('fleetStatsAll')}</span>
        </span>
        <Typography component="span" className={classes.value}>
          {counts.total}
        </Typography>
        <span
          className={classes.bar}
          style={{ width: '100%', backgroundColor: theme.palette.primary.main }}
        />
      </ButtonBase>
      {tiles.map(({ key, label, color, hint }) => {
        const share = counts.total ? (counts[key] / counts.total) * 100 : 0;
        return (
          <ButtonBase
            key={key}
            className={classes.tile}
            style={tileStyle(activities.includes(key), color)}
            onClick={() => toggle(key)}
            title={hint ? `${label} · ${hint}` : label}
            aria-pressed={activities.includes(key)}
          >
            <span className={classes.label}>
              <span className={classes.dot} style={{ backgroundColor: color }} />
              <span className={classes.labelText}>{label}</span>
            </span>
            <Typography component="span" className={classes.value}>
              {counts[key]}
            </Typography>
            {hint && <span className={classes.hint}>{hint}</span>}
            <span className={classes.bar} style={{ width: `${share}%`, backgroundColor: color }} />
          </ButtonBase>
        );
      })}
    </div>
  );
};

export default FleetStats;

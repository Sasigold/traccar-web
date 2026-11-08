import { makeStyles } from 'tss-react/mui';
import { useChartTheme } from './chartTheme';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(1),
  },
  value: {
    ...theme.typography.kpi,
    color: theme.palette.text.primary,
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
    transition: `width ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.standard}`,
  },
  label: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
  },
}));

// A ratio against 100%: the fill and a lighter track of the same ramp.
const Meter = ({ value, text, label }) => {
  const { classes } = useStyles();
  const chart = useChartTheme();
  const ratio = Math.max(0, Math.min(1, (value ?? 0) / 100));
  return (
    <div
      className={classes.root}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? 0}
      aria-label={label}
    >
      <span className={classes.value} dir="ltr">
        {text}%
      </span>
      <div className={classes.track} style={{ backgroundColor: chart.track }}>
        <div
          className={classes.fill}
          style={{ width: `${ratio * 100}%`, backgroundColor: chart.single }}
        />
      </div>
      <span className={classes.label}>{label}</span>
    </div>
  );
};

export default Meter;

import { makeStyles } from 'tss-react/mui';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import useAnimatedNumber from '../../common/components/telemetry/useAnimatedNumber';
import Sparkline from './Sparkline';
import { useChartTheme } from './chartTheme';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    height: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    overflow: 'hidden',
    transition: `opacity ${theme.tokens.motion.duration.base}ms`,
  },
  flat: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  label: {
    ...theme.typography.caption,
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  line: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5, 1),
    minWidth: 0,
  },
  value: {
    ...theme.typography.kpi,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
  small: {
    ...theme.typography.h4,
  },
  unit: {
    ...theme.typography.body2,
    color: theme.palette.surface.textSecondaryOnTint,
    fontWeight: 500,
  },
  delta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    ...theme.typography.caption,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  deltaIcon: {
    fontSize: 14,
  },
  context: {
    ...theme.typography.caption,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  spark: {
    marginTop: 'auto',
    minHeight: 0,
  },
}));

// Stat tile: label, value (+ unit), change against the comparable earlier period, and
// a small trend line when there is room. The value counts smoothly to new numbers.
const StatTile = ({
  label,
  value,
  format,
  unit,
  deltaValue,
  deltaText,
  // REP-18: what the change is against ("לעומת 1.11–7.11") and an optional target line.
  deltaContext,
  targetText,
  // Kept for callers; a change is no longer colored as good or bad (REP-18).
  // eslint-disable-next-line no-unused-vars
  goodWhenUp = true,
  points,
  width,
  height,
  flat = false,
  stale = false,
  title,
}) => {
  const { classes, cx } = useStyles();
  const chart = useChartTheme();
  const animated = useAnimatedNumber(value ?? 0);
  const shown = value == null ? '—' : format(animated);
  // REP-18: a change is a fact, not a verdict: text color with an arrow, and what it is against.
  const deltaColor = chart.text;
  const compact = width < 170 || height < 84;
  const sparkHeight = Math.min(48, height - 84);
  return (
    <div
      className={cx(classes.root, flat && classes.flat)}
      style={{
        opacity: stale ? 0.6 : 1,
        // Without a trend line, a tall tile centers its figure instead of leaving a hole.
        justifyContent: points && sparkHeight >= 18 && width > 90 ? 'flex-start' : 'center',
      }}
      title={title}
    >
      <span className={classes.label}>{label}</span>
      <div className={classes.line}>
        <span className={cx(classes.value, compact && classes.small)} dir="ltr">
          {shown}
          {unit === '%' && value != null ? '%' : ''}
        </span>
        {unit && unit !== '%' && <span className={classes.unit}>{unit}</span>}
        {deltaText && (
          <span className={classes.delta} style={{ color: deltaColor }} dir="ltr">
            {deltaValue > 0 && <ArrowUpwardRoundedIcon className={classes.deltaIcon} />}
            {deltaValue < 0 && <ArrowDownwardRoundedIcon className={classes.deltaIcon} />}
            {deltaValue ? deltaText.replace(/^[+−]/, '') : deltaText}
          </span>
        )}
      </div>
      {!compact && ((deltaText && deltaContext) || targetText) ? (
        <span className={classes.context}>
          {[deltaText && deltaContext, targetText].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {points && sparkHeight >= 18 && width > 90 && (
        <div className={classes.spark}>
          <Sparkline
            values={points}
            width={Math.max(0, width - (flat ? 0 : 24))}
            height={sparkHeight}
            // The axis tone: a trend line is information and needs 3:1 (the "other" tone is
            // about 1.5:1 on white).
            color={chart.axis}
            accent={chart.accent}
            surface={chart.surface}
          />
        </div>
      )}
    </div>
  );
};

export default StatTile;

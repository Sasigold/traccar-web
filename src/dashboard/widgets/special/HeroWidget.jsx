import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import useAnimatedNumber from '../../../common/components/telemetry/useAnimatedNumber';
import { brandPanel } from '../../../common/theme/surfaces';
import Sparkline from '../../charts/Sparkline';
import { useMetric } from '../useWidgetModel';
import { useLabels } from '../useLabels';
import { toDisplay } from '../../data/format';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    ...brandPanel(),
    borderRadius: theme.tokens.radius.lg,
    padding: theme.spacing(2, 2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    overflow: 'hidden',
  },
  value: {
    ...theme.typography.hero,
    color: theme.palette.brand.paper,
  },
  small: {
    ...theme.typography.kpi,
  },
  label: {
    ...theme.typography.subtitle1,
    // Aqua type on navy is an approved pairing (BRAND.md §4).
    color: theme.palette.brand.aqua,
  },
  spark: {
    marginTop: 'auto',
  },
}));

// The one hero number of a dashboard: navy tile, paper figure, aqua label
// (brand book mobile concept).
const HeroWidget = ({ query, width, height }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const { brand } = useTheme().palette;
  const labels = useLabels();
  const metric = `${query?.ds ?? 'live'}.${query?.m ?? 'moving'}`;
  const result = useMetric(metric, { compare: false });
  const unit = result.measure?.unit;
  const value = toDisplay(result.value, unit, labels.prefs);
  const animated = useAnimatedNumber(value ?? 0);
  const compact = height < 150 || width < 200;
  const sparkHeight = Math.min(56, height - 130);
  const points = result.points?.map((point) => toDisplay(point.value, unit, labels.prefs));
  return (
    <div className={classes.root}>
      <span className={cx(classes.value, compact && classes.small)} dir="ltr">
        {value == null ? '—' : labels.displayText(animated, unit)}
      </span>
      <span className={classes.label}>{result.measure ? t(result.measure.labelKey) : ''}</span>
      {points && sparkHeight >= 24 && (
        <div className={classes.spark}>
          <Sparkline
            values={points}
            width={width - 40}
            height={sparkHeight}
            color={brand.aqua}
            accent={brand.aqua}
            surface={brand.navy}
          />
        </div>
      )}
    </div>
  );
};

export default HeroWidget;

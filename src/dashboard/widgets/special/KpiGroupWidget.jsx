import { useDashboardData } from '../../data/DashboardDataContext';
import { compareRangeText } from '../../charts/chartContext';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useFleetStatus } from '../../../common/fleet/useFleet';
import StatTile from '../../charts/StatTile';
import { DATASETS } from '../../data/datasets';
import { distributeEven } from '../../layout/model';
import { formatDelta, toDisplay } from '../../data/format';
import { useLabels } from '../useLabels';
import { useMetric } from '../useWidgetModel';

const GAP = 8;
const MIN_TILE_HEIGHT = 74;
const MIN_TILE_WIDTH = 150;

const useStyles = makeStyles()({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: GAP,
  },
  row: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    gap: GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});

// Tiles balance themselves into rows that always fill the width: five tiles become
// 3 + 2, each row stretching its tiles, so the group never leaves a hole.
export const balance = (count, width, height) => {
  const maxRows = Math.max(1, Math.floor((height + GAP) / (MIN_TILE_HEIGHT + GAP)));
  const fitPerRow = Math.max(1, Math.floor((width + GAP) / (MIN_TILE_WIDTH + GAP)));
  const perRow = Math.max(Math.ceil(count / maxRows), Math.min(count, fitPerRow));
  const rows = Math.ceil(count / perRow);
  return distributeEven(count, rows);
};

const Metric = ({ metric, compare, width, height, stale }) => {
  const t = useTranslation();
  const { unitLabel, displayText, prefs, language } = useLabels();
  const result = useMetric(metric, { compare });
  const { previous } = useDashboardData();
  const compareText = compareRangeText(previous);
  const fleetStatus = useFleetStatus();
  const unit = result.measure?.unit;
  const value = result.status === 'success' ? toDisplay(result.value, unit, prefs) : null;
  const unavailable =
    result.status === 'fleet' || result.status === 'error' || result.status === 'tooLarge';
  let title;
  if (result.status === 'fleet') {
    title = fleetStatus === 'error' ? t('dashboardFleetUnavailable') : t('fleetNoAccess');
  } else if (unavailable) {
    title = t('dashboardLoadError');
  }
  return (
    <StatTile
      label={result.measure ? t(result.measure.labelKey) : metric}
      value={unavailable ? null : value}
      format={(number) => displayText(number, unit)}
      unit={
        unit && unit !== 'money' && unit !== 'percent' && unit !== 'count'
          ? unitLabel(unit)
          : unit === 'percent'
            ? '%'
            : null
      }
      deltaValue={result.delta}
      deltaText={formatDelta(result.delta, language)}
      deltaContext={
        result.delta != null && compareText
          ? t('dashboardComparedTo').replace('{0}', compareText)
          : undefined
      }
      goodWhenUp={result.measure?.good !== 'down'}
      points={result.points?.map((point) => toDisplay(point.value, unit, prefs))}
      width={width}
      height={height}
      stale={stale || result.stale}
      title={title}
    />
  );
};

const KpiGroupWidget = ({ metrics, compare, width, height }) => {
  const { classes } = useStyles();
  const list = metrics.filter((metric) => DATASETS[metric.split('.')[0]]);
  const rows = balance(list.length, width, height);
  const tileHeight = (height - GAP * (rows.length - 1)) / rows.length;
  let index = 0;
  return (
    <div className={classes.root}>
      {rows.map((count, rowIndex) => {
        const slice = list.slice(index, index + count);
        index += count;
        const tileWidth = (width - GAP * (count - 1)) / count;
        return (
          <div key={rowIndex} className={classes.row}>
            {slice.map((metric) => (
              <div key={metric} className={classes.cell}>
                <Metric metric={metric} compare={compare} width={tileWidth} height={tileHeight} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default KpiGroupWidget;

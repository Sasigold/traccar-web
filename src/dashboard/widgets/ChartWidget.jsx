import { makeStyles } from 'tss-react/mui';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import EmptyState from '../../common/components/table/EmptyState';
import FleetNotice from '../../fleet/components/FleetNotice';
import { DATASETS, measureOf, resolveQuery } from '../data/datasets';
import DonutChart from '../charts/DonutChart';
import RankedBars from '../charts/RankedBars';
import SegmentedBar from '../charts/SegmentedBar';
import ColumnChart from '../charts/ColumnChart';
import LineAreaChart from '../charts/LineAreaChart';
import StatTile from '../charts/StatTile';
import Meter from '../charts/Meter';
import TableView from '../charts/TableView';
import { WidgetState } from './WidgetFrame';
import { shapeOf } from './WidgetSkeleton';
import { allowedViz, effectiveTopN, pickViz } from './vizRules';
import { useWidgetData } from './useWidgetModel';
import { useView } from './present';
import { useLabels } from './useLabels';

const useStyles = makeStyles()({
  fill: {
    position: 'absolute',
    inset: 0,
  },
});

export const resolveChart = (config, preset) => {
  const query = resolveQuery({ ...preset.query, ...config.query });
  const measure = measureOf(query.ds, query.m);
  const allowed = allowedViz(query, measure);
  const viz = pickViz(config.viz ?? preset.viz, allowed, preset.viz);
  return { query, measure, allowed, viz };
};

const isEmpty = (view) => {
  if (!view) {
    return true;
  }
  if (view.kind === 'categorical') {
    return !view.items.some((item) => item.value);
  }
  if (view.kind === 'timeseries') {
    return !view.points.some((point) => point.value);
  }
  return false;
};

// Table rows of a view (also used for Excel export and the focus view).
export const viewTable = (view, { dimensionLabel, measureLabel, t }) => {
  if (!view) {
    return { columns: [], rows: [] };
  }
  if (view.kind === 'timeseries') {
    const series = view.series ?? [];
    return {
      columns: [
        { key: 'label', label: dimensionLabel },
        ...(series.length
          ? series.map((entry) => ({ key: entry.key, label: entry.label, numeric: true }))
          : [{ key: 'value', label: measureLabel, numeric: true }]),
      ],
      rows: view.points
        .filter((point) => !point.future)
        .map((point) => ({
          key: point.key,
          cells: {
            label: point.label,
            value: point.full,
            ...Object.fromEntries(
              series.map((entry) => [entry.key, view.format(point.values?.[entry.key])]),
            ),
          },
        })),
    };
  }
  if (view.kind === 'categorical') {
    return {
      columns: [
        { key: 'label', label: dimensionLabel },
        { key: 'value', label: measureLabel, numeric: true },
        { key: 'share', label: t('dashboardShare'), numeric: true },
      ],
      rows: view.items.map((item) => ({
        key: item.key,
        color: item.color,
        raw: item,
        cells: { label: item.label, value: item.full, share: item.shareText },
      })),
    };
  }
  return {
    columns: [{ key: 'value', label: measureLabel, numeric: true }],
    rows: [{ key: 'value', cells: { value: view.full } }],
  };
};

const ChartWidget = ({
  config,
  preset,
  width,
  height,
  size,
  table,
  onSelect,
  title,
  exportRef,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { unitLabel } = useLabels();
  const { query, measure, viz } = resolveChart(config, preset);
  const data = useWidgetData(query, { topN: effectiveTopN(viz, query.n) });
  const view = useView(data, viz, query.d, query.b);
  const dataset = DATASETS[query.ds];
  const measureLabel = t(measure.labelKey);
  const dimensionLabel = query.d
    ? t(`dashboardD${query.d[0].toUpperCase()}${query.d.slice(1)}`)
    : '';
  if (exportRef) {
    exportRef.current = () => viewTable(view, { dimensionLabel, measureLabel, t });
  }

  if (data.status === 'fleet') {
    return (
      <WidgetState state="notice" notice={<FleetNotice compact permission={dataset.fleet} />} />
    );
  }
  if (['error', 'tooLarge'].includes(data.status) && !view) {
    return <WidgetState state={data.status} error={data.error} />;
  }
  if (!view) {
    return <WidgetState state="loading" loadingLabel={title} shape={shapeOf(viz)} />;
  }
  if (isEmpty(view) && view.kind !== 'scalar') {
    return (
      <EmptyState
        compact
        icon={<QueryStatsRoundedIcon />}
        title={t('dashboardNoData')}
        description={dataset.report ? t('dashboardNoDataPeriod') : null}
      />
    );
  }

  const stale = data.stale ? { opacity: 0.55 } : undefined;
  const select = onSelect ? (item) => onSelect(item, query) : undefined;
  const partialNote = t('dashboardPartial');

  let content;
  if (table) {
    const { columns, rows } = viewTable(view, { dimensionLabel, measureLabel, t });
    content = (
      <TableView
        columns={columns}
        rows={rows}
        caption={title}
        onSelect={view.kind === 'categorical' ? select : undefined}
      />
    );
  } else if (view.kind === 'scalar') {
    content =
      viz === 'meter' ? (
        <Meter
          value={view.value}
          text={view.text}
          label={measureLabel}
          width={width}
          height={height}
        />
      ) : (
        <StatTile
          flat
          label={measureLabel}
          value={view.value}
          format={(value) => view.format(value)}
          unit={measure.unit === 'percent' ? '%' : unitLabel(measure.unit)}
          width={width}
          height={height}
        />
      );
  } else if (viz === 'donut' || viz === 'pie') {
    content =
      size === 'xs' ? (
        <SegmentedBar view={view} width={width} height={height} size={size} onSelect={select} />
      ) : (
        <DonutChart
          view={view}
          width={width}
          height={height}
          size={size}
          variant={viz}
          onSelect={select}
          centerLabel={
            ['count', 'money'].includes(measure.unit) ? measureLabel : unitLabel(measure.unit)
          }
        />
      );
  } else if (viz === 'segmented') {
    content = (
      <SegmentedBar
        view={view}
        width={width}
        height={height}
        size={size}
        onSelect={select}
        caption={['count', 'money'].includes(measure.unit) ? measureLabel : unitLabel(measure.unit)}
      />
    );
  } else if (viz === 'bars') {
    content = (
      <RankedBars
        view={view}
        height={height}
        onSelect={select}
        moreLabel={t('dashboardMoreInTable')}
      />
    );
  } else if (viz === 'line' || viz === 'area') {
    content = (
      <LineAreaChart
        view={view}
        width={width}
        height={height}
        size={size}
        area={viz === 'area'}
        partialNote={partialNote}
      />
    );
  } else {
    content = (
      <ColumnChart
        view={view}
        width={width}
        height={height}
        size={size}
        stacked={viz === 'stacked'}
        onSelect={view.kind === 'categorical' ? select : undefined}
        partialNote={partialNote}
      />
    );
  }

  return (
    <figure
      className={classes.fill}
      style={{ margin: 0, ...stale }}
      aria-label={`${title}: ${view.summary ?? view.full ?? ''}`}
    >
      {content}
    </figure>
  );
};

export default ChartWidget;

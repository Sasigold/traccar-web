import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import TooltipCard from './ChartTooltip';
import ChartLegend from './ChartLegend';
import { reducedMotion, useChartTheme } from './chartTheme';

const LEGEND_HEIGHT = 26;

// Trend over time: a 2px line, or an area with a light wash for a single series.
// A crosshair finds the time; one tooltip lists every series at that point.
const LineAreaChart = ({ view, width, height, size, area = false, partialNote }) => {
  const chart = useChartTheme();
  const series = view.series?.length ? view.series : null;
  const data = useMemo(
    () =>
      view.points.map((point) => ({
        ...point,
        ...(series
          ? Object.fromEntries(
              series.map((entry) => [entry.key, point.values?.[entry.key] ?? null]),
            )
          : {}),
      })),
    [view.points, series],
  );
  const legendHeight = series ? LEGEND_HEIGHT : 0;
  const chartHeight = Math.max(60, height - legendHeight);
  const showAxis = size !== 'xs' && size !== 'sm';
  const animate = !reducedMotion();
  const tick = { fill: chart.axis, fontSize: 11, fontFamily: chart.fontFamily };
  const lines = series ?? [{ key: 'value', color: chart.single, label: null }];
  const lastIndex = data.findLastIndex((point) => point.value != null);

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }
    const point = payload[0].payload;
    const rows = series
      ? series.map((entry) => ({
          key: entry.key,
          color: entry.color,
          text: view.format(point.values?.[entry.key]),
          label: entry.label,
        }))
      : [{ key: 'value', color: chart.single, text: point.full }];
    return (
      <TooltipCard title={point.label} rows={rows} note={point.partial ? partialNote : null} />
    );
  };

  const Chart = area ? AreaChart : LineChart;
  const endDot = (entry) => (props) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx == null || cy == null) {
      return null;
    }
    return (
      <circle
        key={`${entry.key}-end`}
        cx={cx}
        cy={cy}
        r={4}
        fill={entry.color}
        stroke={chart.surface}
        strokeWidth={2}
      />
    );
  };

  return (
    <div style={{ width, height }}>
      <div dir="ltr" style={{ width, height: chartHeight }}>
        <Chart
          width={width}
          height={chartHeight}
          data={data}
          margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
            tick={size === 'xs' ? false : tick}
            interval="preserveStartEnd"
            minTickGap={12}
            height={size === 'xs' ? 4 : 22}
          />
          <YAxis
            hide={!showAxis}
            orientation={chart.rtl ? 'right' : 'left'}
            tickLine={false}
            axisLine={false}
            tick={tick}
            width="auto"
            tickFormatter={(value) => view.format(value)}
            allowDecimals={false}
          />
          <Tooltip
            content={tooltip}
            isAnimationActive={false}
            cursor={{ stroke: chart.axis, strokeWidth: 1 }}
          />
          {lines.map((entry) =>
            area ? (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                stroke={entry.color}
                strokeWidth={2}
                fill={entry.color}
                fillOpacity={series ? chart.areaOpacity / 2 : chart.areaOpacity}
                stackId={series ? 'stack' : undefined}
                connectNulls={false}
                dot={endDot(entry)}
                activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={chart.motion.duration.slow}
              />
            ) : (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                stroke={entry.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                connectNulls={false}
                dot={endDot(entry)}
                activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={chart.motion.duration.slow}
              />
            ),
          )}
        </Chart>
      </div>
      {series && (
        <div style={{ height: legendHeight, display: 'flex', alignItems: 'flex-end' }}>
          <ChartLegend
            shape="line"
            items={series.map((entry) => ({
              key: entry.key,
              label: entry.label,
              color: entry.color,
            }))}
          />
        </div>
      )}
    </div>
  );
};

export default LineAreaChart;

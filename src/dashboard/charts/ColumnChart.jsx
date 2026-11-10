import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { alpha } from '@mui/material/styles';
import TooltipCard from './ChartTooltip';
import ChartLegend from './ChartLegend';
import { reducedMotion, useChartTheme } from './chartTheme';

const LEGEND_HEIGHT = 26;

// Vertical columns for categories or time buckets, optionally stacked by a breakdown.
// The SVG is laid out left to right; categories start at the inline start in RTL,
// time always runs left to right.
const ColumnChart = ({
  view,
  width,
  height,
  size,
  stacked = false,
  onSelect,
  partialNote,
  target,
  targetLabel,
}) => {
  const chart = useChartTheme();
  const timeline = view.kind === 'timeseries';
  const series = stacked && view.series?.length ? view.series : null;
  const data = useMemo(
    () =>
      (timeline ? view.points : view.items).map((item) => ({
        ...item,
        ...(series
          ? Object.fromEntries(series.map((entry) => [entry.key, item.values?.[entry.key] ?? null]))
          : {}),
      })),
    [timeline, view, series],
  );
  const legendHeight = series ? LEGEND_HEIGHT : 0;
  const chartHeight = Math.max(60, height - legendHeight);
  const showAxis = size !== 'xs' && size !== 'sm';
  const max = Math.max(...data.map((item) => item.value ?? 0));
  // Named categories start at the inline start; time and ordered scales (hours, speed
  // bands) always run left to right.
  const reversed = chart.rtl && !timeline && !view.ordinal;
  const animate = !reducedMotion();
  const tick = { fill: chart.axis, fontSize: 11, fontFamily: chart.fontFamily };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
      return null;
    }
    const item = payload[0].payload;
    const rows = series
      ? series
          .filter((entry) => item.values?.[entry.key] != null)
          .map((entry) => ({
            key: entry.key,
            color: entry.color,
            text: view.format(item.values[entry.key]),
            label: entry.label,
          }))
      : [{ key: item.key, color: item.color ?? chart.single, text: item.full }];
    return <TooltipCard title={item.label} rows={rows} note={item.partial ? partialNote : null} />;
  };

  return (
    <div style={{ width, height }}>
      <div dir="ltr" style={{ width, height: chartHeight }}>
        <BarChart
          width={width}
          height={chartHeight}
          data={data}
          margin={{ top: 18, right: 4, left: 4, bottom: 0 }}
          barCategoryGap={data.length > 16 ? '18%' : '28%'}
          onClick={(state) => {
            const index = state?.activeTooltipIndex ?? state?.activeIndex;
            if (onSelect && index != null && data[index]) {
              onSelect(data[index]);
            }
          }}
        >
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis
            dataKey="label"
            reversed={reversed}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
            tick={size === 'xs' ? false : tick}
            interval="preserveStartEnd"
            minTickGap={8}
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
          {target != null && (
            // REP-18: a target, as a dashed line on the value axis.
            <ReferenceLine
              y={target}
              stroke={chart.text}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{
                value: targetLabel,
                position: 'insideTopRight',
                fill: chart.textSecondary,
                fontSize: 11,
              }}
            />
          )}
          <Tooltip
            content={tooltip}
            isAnimationActive={false}
            cursor={{ fill: alpha(chart.text, 0.05) }}
            shared={Boolean(series)}
          />
          {series ? (
            series.map((entry, index) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                stackId="stack"
                fill={entry.color}
                stroke={chart.surface}
                strokeWidth={1}
                maxBarSize={24}
                radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={animate}
                animationDuration={chart.motion.duration.slow}
              >
                {data.map((item) => (
                  <Cell key={item.key} fillOpacity={item.partial ? 0.5 : 1} />
                ))}
              </Bar>
            ))
          ) : (
            <Bar
              dataKey="value"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={animate}
              animationDuration={chart.motion.duration.slow}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              {data.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.color ?? chart.single}
                  fillOpacity={item.partial ? 0.5 : 1}
                />
              ))}
              {size !== 'xs' && (
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={6}
                  content={({ x, y, width: barWidth, value, index }) =>
                    value === max &&
                    value > 0 &&
                    data.findIndex((item) => item.value === max) === index ? (
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fill={chart.text}
                        fontSize={11}
                        fontWeight={600}
                        fontFamily={chart.fontFamily}
                      >
                        {data[index].text}
                      </text>
                    ) : null
                  }
                />
              )}
            </Bar>
          )}
        </BarChart>
      </div>
      {series && (
        <div style={{ height: legendHeight, display: 'flex', alignItems: 'flex-end' }}>
          <ChartLegend
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

export default ColumnChart;

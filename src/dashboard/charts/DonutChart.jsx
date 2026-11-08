import { useState } from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { makeStyles } from 'tss-react/mui';
import ChartLegend from './ChartLegend';
import TooltipCard from './ChartTooltip';
import { reducedMotion, useChartTheme } from './chartTheme';

const useStyles = makeStyles()((theme) => ({
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(3),
    minWidth: 0,
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.spacing(1),
  },
  figure: {
    position: 'relative',
    flexShrink: 0,
    margin: 0,
    alignSelf: 'center',
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    textAlign: 'center',
  },
  total: {
    ...theme.typography.kpi,
    color: theme.palette.text.primary,
  },
  totalSmall: {
    ...theme.typography.h5,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    maxWidth: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  legend: {
    flex: 1,
    minWidth: 0,
    maxWidth: 380,
    overflow: 'hidden',
  },
}));

// Donut (with the total in the middle) or pie. Slices are separated by a 2px surface
// gap; the legend lists every part with its value and share.
const DonutChart = ({ view, width, height, size, variant = 'donut', onSelect, centerLabel }) => {
  const { classes, cx } = useStyles();
  const chart = useChartTheme();
  const [active, setActive] = useState(null);
  const parts = view.items.filter((item) => item.value > 0);
  const side = width >= height * 1.45;
  const legendRows = Math.min(view.items.length, 7);
  const diameter = Math.max(
    64,
    Math.floor(
      side ? Math.min(height, width * 0.48) : Math.min(width, height - legendRows * 20 - 8),
    ),
  );
  const compact = diameter < 150 || (diameter < 220 && String(view.totalText).length > 5);
  const legend = view.items.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    text: size === 'xs' ? null : item.text,
    share: size === 'xs' || side === false ? null : item.shareText,
    raw: item,
  }));

  return (
    <div className={cx(classes.root, !side && classes.stacked)}>
      <figure className={classes.figure} style={{ width: diameter, height: diameter }} dir="ltr">
        <PieChart width={diameter} height={diameter}>
          <Pie
            data={parts}
            dataKey="value"
            nameKey="label"
            innerRadius={variant === 'donut' ? '64%' : 0}
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke={chart.surface}
            strokeWidth={parts.length > 1 ? 2 : 0}
            isAnimationActive={!reducedMotion()}
            animationDuration={chart.motion.duration.slow}
            onMouseEnter={(_, index) => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onClick={(entry) => onSelect?.(entry?.payload ?? entry)}
            style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
          >
            {parts.map((item, index) => (
              <Cell
                key={item.key}
                fill={item.color}
                fillOpacity={active == null || active === index ? 1 : 0.55}
              />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            content={({ active: shown, payload }) =>
              shown && payload?.length ? (
                <TooltipCard
                  rows={[
                    {
                      key: payload[0].payload.key,
                      color: payload[0].payload.color,
                      text: payload[0].payload.full,
                      label: `${payload[0].payload.label} · ${payload[0].payload.shareText}`,
                    },
                  ]}
                />
              ) : null
            }
          />
        </PieChart>
        {variant === 'donut' && (
          <div className={classes.center}>
            <span className={cx(classes.total, compact && classes.totalSmall)} dir="ltr">
              {view.totalText}
            </span>
            {!compact && centerLabel && <span className={classes.caption}>{centerLabel}</span>}
          </div>
        )}
      </figure>
      {size !== 'xs' && (
        <ChartLegend
          className={classes.legend}
          items={legend}
          column={side}
          onSelect={onSelect ? (item) => onSelect(item.raw) : undefined}
        />
      )}
    </div>
  );
};

export default DonutChart;

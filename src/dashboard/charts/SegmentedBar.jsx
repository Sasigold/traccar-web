import { useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import { getContrastRatio, useTheme } from '@mui/material/styles';
import ChartLegend from './ChartLegend';

const useStyles = makeStyles()((theme) => ({
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  headline: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  },
  total: {
    ...theme.typography.kpi,
    color: theme.palette.text.primary,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
  },
  bar: {
    display: 'flex',
    gap: 2,
    width: '100%',
    minWidth: 0,
  },
  segment: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    borderRadius: 4,
    overflow: 'hidden',
    paddingInline: theme.spacing(0.75),
    outline: 'none',
    cursor: 'default',
    transition: `flex-grow ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.standard}, opacity ${theme.tokens.motion.duration.fast}ms`,
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.secondary.main}`,
    },
  },
  clickable: {
    cursor: 'pointer',
  },
  inner: {
    ...theme.typography.caption,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

// One whole split into parts: a 28px segmented bar (thin when space is short) with
// each part's share printed inside when it fits, and a legend with the figures.
const SegmentedBar = ({ view, width, height, size, onSelect, caption }) => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const { white, ink } = theme.palette.brand;
  const [active, setActive] = useState(null);
  const parts = view.items.filter((item) => item.value > 0);
  const total = parts.reduce((sum, item) => sum + item.value, 0);
  const thick = size === 'xs' ? 8 : 28;
  const showHeadline = height >= 150 && size !== 'xs';
  return (
    <div className={classes.root}>
      {showHeadline && (
        <div className={classes.headline}>
          <span className={classes.total} dir="ltr">
            {view.totalText}
          </span>
          {caption && <span className={classes.caption}>{caption}</span>}
        </div>
      )}
      <div className={classes.bar} style={{ height: thick }} role="group" aria-label={view.summary}>
        {parts.map((item, index) => {
          const share = total ? item.value / total : 0;
          // White on dark fills, ink on light ones (labels inside a fill are the one exception
          // to "text never wears the data color").
          const labelColor =
            getContrastRatio(item.color, white) >= getContrastRatio(item.color, ink) ? white : ink;
          const fits = thick >= 20 && share * width > 44;
          return (
            <span
              key={item.key}
              className={cx(classes.segment, onSelect && classes.clickable)}
              style={{
                flexGrow: item.value,
                flexBasis: 0,
                backgroundColor: item.color,
                borderRadius: thick < 20 ? thick / 2 : 4,
                opacity: active == null || active === index ? 1 : 0.55,
              }}
              role="img"
              tabIndex={0}
              title={`${item.label}: ${item.full} · ${item.shareText}`}
              aria-label={`${item.label}: ${item.full} · ${item.shareText}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              onClick={onSelect ? () => onSelect(item) : undefined}
            >
              {fits && (
                <span className={classes.inner} dir="ltr" style={{ color: labelColor }}>
                  {item.shareText}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <ChartLegend
        items={view.items.map((item) => ({
          key: item.key,
          label: item.label,
          color: item.color,
          text: item.text,
          raw: item,
        }))}
        onSelect={onSelect ? (item) => onSelect(item.raw) : undefined}
      />
    </div>
  );
};

export default SegmentedBar;

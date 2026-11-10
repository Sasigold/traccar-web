import { useMemo, useRef } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { indexAtTime, stepByTime } from './replayTimeline';

const HEIGHT = 36;
const BAR = 10;

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    height: HEIGHT,
    cursor: 'pointer',
    touchAction: 'none',
    borderRadius: theme.tokens.radius.sm,
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.focus}`,
      outlineOffset: 2,
    },
  },
  svg: {
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
}));

// LIV-10: the replay line by time. Driving is the brand line (navy, aqua at night), standing is
// slate, a gap with no fix is dashed, and stops are ticks above it. One SVG with a rectangle per
// part, not an element per point, so a day of 80,000 points stays light. The player always runs
// left to right, like the gauges.
//
// Keyboard: arrows move a point, Shift+arrows a minute, Home/End the ends.
// LIV-10: events (alarms, overspeed...) are dots under the bar, each with its name on hover.
const ReplayTimeline = ({ positions, segments, stops, events = [], index, onChange }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const ref = useRef(null);

  const start = new Date(positions[0].fixTime).getTime();
  const end = new Date(positions[positions.length - 1].fixTime).getTime();
  const span = Math.max(end - start, 1);
  const x = (time) => ((time - start) / span) * 100;

  const colors = {
    moving: theme.palette.primary.main,
    stopped: theme.palette.neutral.main,
  };

  const parts = useMemo(
    () =>
      segments.map((segment) => ({
        key: `${segment.fromIndex}`,
        type: segment.type,
        x: ((segment.start - start) / span) * 100,
        width: Math.max(((segment.end - segment.start) / span) * 100, 0.15),
      })),
    [segments, start, span],
  );

  const pick = (event) => {
    const box = ref.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    onChange(indexAtTime(positions, start + ratio * span));
  };

  const onKeyDown = (event) => {
    let next = null;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    if (forward || backward) {
      const direction = forward ? 1 : -1;
      next = event.shiftKey
        ? stepByTime(positions, index, direction * 60000)
        : Math.min(Math.max(index + direction, 0), positions.length - 1);
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = positions.length - 1;
    }
    if (next != null) {
      event.preventDefault();
      onChange(next);
    }
  };

  const current = x(new Date(positions[index].fixTime).getTime());

  return (
    <div
      ref={ref}
      dir="ltr"
      className={classes.root}
      role="slider"
      tabIndex={0}
      aria-label={t('replayTimeline')}
      aria-valuemin={0}
      aria-valuemax={positions.length - 1}
      aria-valuenow={index}
      aria-valuetext={formatTime(positions[index].fixTime, 'seconds')}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        ref.current.setPointerCapture?.(event.pointerId);
        pick(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons) pick(event);
      }}
    >
      <svg className={classes.svg} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none">
        {parts.map((part) =>
          part.type === 'gap' ? (
            <line
              key={part.key}
              x1={part.x}
              x2={part.x + part.width}
              y1={HEIGHT / 2}
              y2={HEIGHT / 2}
              stroke={theme.palette.text.disabled}
              strokeWidth={2}
              strokeDasharray="1.5 1"
              vectorEffect="non-scaling-stroke"
              data-part="gap"
            />
          ) : (
            <rect
              key={part.key}
              x={part.x}
              y={(HEIGHT - BAR) / 2}
              width={part.width}
              height={BAR}
              fill={colors[part.type]}
              data-part={part.type}
            />
          ),
        )}
        {stops.map((stop) => (
          <line
            key={stop.index}
            x1={x(stop.start)}
            x2={x(stop.start)}
            y1={2}
            y2={(HEIGHT - BAR) / 2 - 2}
            stroke={theme.palette.text.secondary}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {events
          .filter((event) => {
            const at = new Date(event.eventTime).getTime();
            return at >= start && at <= end;
          })
          .map((event) => (
            <line
              key={event.id}
              x1={x(new Date(event.eventTime).getTime())}
              x2={x(new Date(event.eventTime).getTime())}
              y1={(HEIGHT + BAR) / 2 + 3}
              y2={HEIGHT - 1}
              stroke={theme.palette.warning.main}
              strokeWidth={4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              data-part="event"
            >
              <title>{`${formatTime(event.eventTime, 'time')} · ${event.label}`}</title>
            </line>
          ))}
        <line
          x1={current}
          x2={current}
          y1={4}
          y2={HEIGHT - 4}
          stroke={theme.palette.text.primary}
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

export default ReplayTimeline;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import WidgetHost, { widgetTitle } from '../widgets/WidgetHost';
import { widgetInfo } from '../widgets/catalog';
import { COLS, GAP, GAP_COMPACT, UNIT, unitsToPx } from './model';
import { layoutMode, toVisual } from './responsive';
import { hitTest, sameTarget } from './hitTest';
import { resizeBoundary, resizeStackBoundary, setRowHeight } from './operations';
import useElementSize from './useElementSize';
import useFlip from './useFlip';

const HANDLE = 14;

const useStyles = makeStyles()((theme) => ({
  canvas: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  editing: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  row: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
    flexShrink: 0,
  },
  cell: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  item: {
    position: 'relative',
    minHeight: 0,
    flexShrink: 0,
  },
  divider: {
    position: 'absolute',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    outline: 'none',
    '&::after': {
      content: '""',
      borderRadius: 2,
      backgroundColor: 'transparent',
      transition: `background-color ${theme.tokens.motion.duration.fast}ms`,
    },
    '&:hover::after, &:focus-visible::after, &[data-active="true"]::after': {
      backgroundColor: theme.palette.secondary.main,
    },
  },
  vertical: {
    top: 8,
    bottom: 8,
    width: HANDLE,
    cursor: 'col-resize',
    '&::after': {
      width: 4,
      height: '40%',
      minHeight: 32,
      backgroundColor: alpha(theme.palette.text.primary, 0.12),
    },
  },
  horizontal: {
    insetInline: 8,
    height: HANDLE,
    cursor: 'row-resize',
    '&::after': {
      height: 4,
      width: '18%',
      minWidth: 40,
      backgroundColor: alpha(theme.palette.text.primary, 0.12),
    },
  },
  badge: {
    position: 'absolute',
    zIndex: 3,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.cta.contrastText,
    ...theme.typography.caption,
    fontWeight: 700,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)',
  },
  indicator: {
    position: 'absolute',
    zIndex: 4,
    pointerEvents: 'none',
    borderRadius: 3,
    backgroundColor: theme.palette.secondary.main,
    transition: `all ${theme.tokens.motion.duration.fast}ms ${theme.tokens.motion.easing.standard}`,
  },
  swap: {
    backgroundColor: alpha(theme.palette.secondary.main, 0.12),
    border: `2px solid ${theme.palette.secondary.main}`,
    borderRadius: theme.tokens.radius.xl,
  },
  ghost: {
    position: 'fixed',
    zIndex: theme.layers.palette,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    boxShadow: theme.shadows[3],
    ...theme.typography.subtitle2,
    color: theme.palette.text.primary,
    transform: 'translate(12px, 12px) rotate(-1.5deg)',
    maxWidth: 280,
  },
  live: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
}));

const scrollParent = (element) => {
  let node = element?.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement;
};

// One draggable divider. `onDrag(deltaPx)` gets the pointer travel since the start
// (logical for vertical dividers), `onEnd()` commits, keys move one step.
const Divider = ({
  className,
  style,
  label,
  value,
  onStart,
  onDrag,
  onEnd,
  onKey,
  orientation,
}) => {
  const { classes, cx } = useStyles();
  const [active, setActive] = useState(false);
  const startRef = useRef(null);
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={value}
      data-active={active}
      className={cx(
        classes.divider,
        orientation === 'vertical' ? classes.vertical : classes.horizontal,
        className,
      )}
      style={style}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        startRef.current = { x: event.clientX, y: event.clientY };
        setActive(true);
        onStart();
      }}
      onPointerMove={(event) => {
        if (startRef.current) {
          onDrag(event.clientX - startRef.current.x, event.clientY - startRef.current.y);
        }
      }}
      onPointerUp={() => {
        if (startRef.current) {
          startRef.current = null;
          setActive(false);
          onEnd();
        }
      }}
      onPointerCancel={() => {
        startRef.current = null;
        setActive(false);
        onEnd(true);
      }}
      onKeyDown={onKey}
    />
  );
};

// The grid. Rows are CSS grids of 12 columns (cells span their width, so edges line up
// across rows); stacks are columns of exact heights. In edit mode on wide screens the
// dividers resize live and widgets can be dragged onto each other's edges.
const DashboardCanvas = ({ rows, widgets, editing, api, onRows, highlightId }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const finePointer = useMediaQuery('(pointer: fine)');
  const gap = desktop ? GAP : GAP_COMPACT;
  const rtl = theme.direction === 'rtl';
  const containerRef = useRef(null);
  const [sizeRef, size] = useElementSize();
  const setRefs = useCallback(
    (element) => {
      containerRef.current = element;
      sizeRef(element);
    },
    [sizeRef],
  );

  const infoOf = useCallback(
    (id) => {
      const info = widgetInfo(widgets[id]);
      return { ...info.min, mobileH: info.mobileH, pair: info.pair };
    },
    [widgets],
  );
  const minOf = useCallback((id) => widgetInfo(widgets[id]).min, [widgets]);

  const mode = layoutMode(size.width || 1200);
  const visual = useMemo(
    () => toVisual(rows, size.width || 1200, infoOf, gap),
    [rows, size.width, infoOf, gap],
  );
  const pointerEdit = editing && mode === 'wide' && finePointer;

  // ─── live resizing ───────────────────────────────────────────────────────
  const [resizing, setResizing] = useState(null); // { badge: { x, y, text } }
  const resizeStartRef = useRef(null);
  const columnPx = (size.width - (COLS - 1) * gap) / COLS;
  const unitPx = UNIT + gap;

  const beginResize = () => {
    resizeStartRef.current = rows;
  };
  const endResize = (cancel) => {
    const startRows = resizeStartRef.current;
    resizeStartRef.current = null;
    setResizing(null);
    if (cancel && startRows) {
      onRows(startRows, { preview: true });
    }
    onRows(null, { commit: true });
  };

  const [announce, setAnnounce] = useState('');

  // ─── drag to move ────────────────────────────────────────────────────────
  const [drag, setDrag] = useState(null); // { id, x, y, target }
  const dragRef = useRef(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const widgetRects = [...container.querySelectorAll('[data-widget-id]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.widgetId,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });
    const rowRects = [...container.querySelectorAll('[data-row-index]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { index: Number(element.dataset.rowIndex), top: rect.top, bottom: rect.bottom };
    });
    return { widgetRects, rowRects };
  }, []);

  const startDrag = useCallback(
    (id, event) => {
      if (!pointerEdit) {
        return;
      }
      event.preventDefault();
      dragRef.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        started: false,
        target: null,
      };
    },
    [pointerEdit],
  );

  useEffect(() => {
    let frame = 0;
    let scrollSpeed = 0;
    const scroller = scrollParent(containerRef.current);
    const autoScroll = () => {
      if (scrollSpeed && scroller) {
        scroller.scrollTop += scrollSpeed;
        frame = requestAnimationFrame(autoScroll);
      } else {
        frame = 0;
      }
    };
    const onMove = (event) => {
      const state = dragRef.current;
      if (!state) {
        return;
      }
      if (
        !state.started &&
        Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5
      ) {
        return;
      }
      state.started = true;
      const { widgetRects, rowRects } = measure();
      const target = hitTest(
        { x: event.clientX, y: event.clientY },
        widgetRects,
        rowRects,
        rtl ? 'rtl' : 'ltr',
        state.id,
      );
      if (!sameTarget(target, state.target)) {
        state.target = target;
      }
      setDrag({ id: state.id, x: event.clientX, y: event.clientY, target: state.target });
      if (scroller) {
        const box =
          scroller === document.scrollingElement
            ? { top: 0, bottom: window.innerHeight }
            : scroller.getBoundingClientRect();
        const edge = 64;
        if (event.clientY < box.top + edge) {
          scrollSpeed = -Math.ceil((box.top + edge - event.clientY) / 4);
        } else if (event.clientY > box.bottom - edge) {
          scrollSpeed = Math.ceil((event.clientY - (box.bottom - edge)) / 4);
        } else {
          scrollSpeed = 0;
        }
        if (scrollSpeed && !frame) {
          frame = requestAnimationFrame(autoScroll);
        }
      }
    };
    const finish = (commit) => {
      const state = dragRef.current;
      dragRef.current = null;
      scrollSpeed = 0;
      setDrag(null);
      if (commit && state?.started && state.target) {
        api.onMove(state.id, state.target);
      }
    };
    const onUp = () => finish(true);
    const onKey = (event) => {
      if (event.key === 'Escape' && dragRef.current) {
        finish(false);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [api, measure, rtl]);

  const hostApi = useMemo(
    () => ({ ...api, onDragStart: startDrag, canDrag: pointerEdit }),
    [api, startDrag, pointerEdit],
  );

  // ─── reflow animation ────────────────────────────────────────────────────
  const signature = useMemo(
    () =>
      visual
        .map(
          (line) =>
            `${line.h}:${line.cells.map((cell) => `${cell.w}(${cell.items.map((item) => `${item.id}/${item.h}`).join(',')})`).join('|')}`,
        )
        .join(';'),
    [visual],
  );
  useFlip(containerRef, signature, {
    enabled: !resizing,
    duration: theme.tokens.motion.duration.slow,
    easing: theme.tokens.motion.easing.standard,
  });

  // ─── indicator geometry ──────────────────────────────────────────────────
  const indicator = useMemo(() => {
    if (!drag?.target || !containerRef.current) {
      return null;
    }
    const box = containerRef.current.getBoundingClientRect();
    const { target } = drag;
    const element = (id) =>
      containerRef.current.querySelector(`[data-widget-id="${id}"]`)?.getBoundingClientRect();
    if (target.kind === 'row') {
      const rowElements = [...containerRef.current.querySelectorAll('[data-row-index]')];
      let y;
      if (target.index === 0) {
        y = rowElements[0].getBoundingClientRect().top - gap / 2;
      } else {
        y = rowElements[target.index - 1].getBoundingClientRect().bottom + gap / 2;
      }
      return {
        className: classes.indicator,
        style: { left: 0, width: box.width, top: y - box.top - 2, height: 4 },
      };
    }
    const rect = element(target.of ?? target.with);
    if (!rect) {
      return null;
    }
    const left = rect.left - box.left;
    const top = rect.top - box.top;
    if (target.kind === 'swap') {
      return {
        className: cx(classes.indicator, classes.swap),
        style: { left, top, width: rect.width, height: rect.height },
      };
    }
    if (target.kind === 'stack') {
      const y = target.side === 'top' ? top - gap / 2 : top + rect.height + gap / 2;
      return {
        className: classes.indicator,
        style: { left, width: rect.width, top: y - 2, height: 4 },
      };
    }
    const physicalLeft = (target.side === 'start') !== rtl;
    const x = physicalLeft ? left - gap / 2 : left + rect.width + gap / 2;
    return {
      className: classes.indicator,
      style: { left: x - 2, top, width: 4, height: rect.height },
    };
  }, [drag, gap, rtl, classes, cx]);

  // ─── render ──────────────────────────────────────────────────────────────
  const physicalOffset = (logical) => (rtl ? { right: logical } : { left: logical });

  return (
    <div ref={setRefs} className={cx(classes.canvas, editing && classes.editing)} style={{ gap }}>
      {visual.map((line, lineIndex) => {
        const savedRow = rows.find((row) => row.id === line.rowId);
        return (
          <div
            key={line.key}
            className={classes.row}
            style={{ height: unitsToPx(line.h, gap), columnGap: gap }}
            data-row-index={mode === 'wide' ? lineIndex : undefined}
          >
            {line.cells.map((cell, cellIndex) => (
              <div
                key={cell.key}
                className={classes.cell}
                style={{ gridColumn: `span ${cell.w}`, gap }}
              >
                {cell.items.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className={classes.item}
                    style={{ height: unitsToPx(item.h, gap) }}
                    data-flip={item.id}
                  >
                    <WidgetHost
                      id={item.id}
                      config={widgets[item.id]}
                      editing={editing}
                      highlight={highlightId === item.id}
                      dragging={drag?.id === item.id}
                      api={hostApi}
                    />
                    {pointerEdit && itemIndex < cell.items.length - 1 && (
                      <Divider
                        orientation="horizontal"
                        label={t('dashboardResizeStack')}
                        value={item.h}
                        style={{ bottom: -(gap + HANDLE) / 2 }}
                        onStart={beginResize}
                        onDrag={(dx, dy) => {
                          const delta = Math.round(dy / unitPx);
                          onRows(
                            resizeStackBoundary(
                              resizeStartRef.current,
                              cell.cellId,
                              itemIndex,
                              delta,
                              minOf,
                            ),
                            { preview: true },
                          );
                          setResizing({ badge: null });
                        }}
                        onEnd={endResize}
                        onKey={(event) => {
                          const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
                          if (step) {
                            event.preventDefault();
                            onRows(resizeStackBoundary(rows, cell.cellId, itemIndex, step, minOf), {
                              commit: true,
                              history: true,
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                ))}
                {pointerEdit && cellIndex < line.cells.length - 1 && (
                  <Divider
                    orientation="vertical"
                    label={t('dashboardResizeWidth')}
                    value={cell.w}
                    style={{
                      top: 8,
                      bottom: 8,
                      ...(rtl ? { left: -(gap + HANDLE) / 2 } : { right: -(gap + HANDLE) / 2 }),
                    }}
                    onStart={beginResize}
                    onDrag={(dx) => {
                      const logical = rtl ? -dx : dx;
                      const delta = Math.round(logical / (columnPx + gap));
                      const next = resizeBoundary(
                        resizeStartRef.current,
                        line.rowId,
                        cellIndex,
                        delta,
                        minOf,
                      );
                      onRows(next, { preview: true });
                      const row = next.find((candidate) => candidate.id === line.rowId);
                      const widths = row.cells.map((candidate) => candidate.w);
                      const start = widths
                        .slice(0, cellIndex + 1)
                        .reduce((sum, value) => sum + value, 0);
                      setResizing({
                        badge: {
                          text: `${widths[cellIndex]} | ${widths[cellIndex + 1]}`,
                          style: {
                            ...physicalOffset(start * (columnPx + gap) - gap / 2),
                            top: '50%',
                            transform: `translate(${rtl ? '50%' : '-50%'}, -50%)`,
                          },
                          rowId: line.rowId,
                        },
                      });
                    }}
                    onEnd={endResize}
                    onKey={(event) => {
                      const physical = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
                      if (physical) {
                        event.preventDefault();
                        const next = resizeBoundary(
                          rows,
                          line.rowId,
                          cellIndex,
                          rtl ? -physical : physical,
                          minOf,
                        );
                        onRows(next, { commit: true, history: true });
                        const row = next.find((candidate) => candidate.id === line.rowId);
                        setAnnounce(row.cells.map((candidate) => candidate.w).join(' / '));
                      }
                    }}
                  />
                )}
              </div>
            ))}
            {pointerEdit && savedRow && (
              <Divider
                orientation="horizontal"
                label={t('dashboardResizeHeight')}
                value={line.h}
                style={{ bottom: -(gap + HANDLE) / 2 }}
                onStart={beginResize}
                onDrag={(dx, dy) => {
                  const start = resizeStartRef.current.find((row) => row.id === line.rowId);
                  const next = setRowHeight(
                    resizeStartRef.current,
                    line.rowId,
                    start.h + Math.round(dy / unitPx),
                    minOf,
                  );
                  onRows(next, { preview: true });
                  const height = next.find((row) => row.id === line.rowId).h;
                  setResizing({
                    badge: {
                      text: `${height} × ${UNIT}`,
                      style: { left: '50%', bottom: -gap / 2, transform: 'translate(-50%, 50%)' },
                      rowId: line.rowId,
                    },
                  });
                }}
                onEnd={endResize}
                onKey={(event) => {
                  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
                  if (step) {
                    event.preventDefault();
                    onRows(setRowHeight(rows, line.rowId, line.h + step, minOf), {
                      commit: true,
                      history: true,
                    });
                    setAnnounce(String(line.h + step));
                  }
                }}
              />
            )}
            {resizing?.badge && line.rowId && resizing.badge.rowId === line.rowId && (
              <span className={classes.badge} style={resizing.badge.style} dir="ltr">
                {resizing.badge.text}
              </span>
            )}
          </div>
        );
      })}
      {indicator && <div className={indicator.className} style={indicator.style} />}
      {drag &&
        createPortal(
          <div className={classes.ghost} style={{ left: drag.x, top: drag.y }}>
            <DragIndicatorRoundedIcon fontSize="small" />
            {widgetTitle(widgets[drag.id], t)}
          </div>,
          document.body,
        )}
      <div className={classes.live} aria-live="polite">
        {announce}
      </div>
    </div>
  );
};

export default DashboardCanvas;

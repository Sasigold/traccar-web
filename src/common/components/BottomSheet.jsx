import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ButtonBase } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from './LocalizationProvider';
import { prefersReducedMotion } from '../../map/core/movingIcon';

export const SHEET_STATES = ['peek', 'half', 'full'];
const SNAP_MS = 260;

const useStyles = makeStyles()((theme) => ({
  sheet: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    overflow: 'hidden',
    borderStartStartRadius: theme.tokens.radius.xl,
    borderStartEndRadius: theme.tokens.radius.xl,
  },
  top: {
    flexShrink: 0,
  },
  handle: {
    touchAction: 'none',
    cursor: 'grab',
  },
  grabber: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    height: 20,
    '&::before': {
      content: '""',
      width: 36,
      height: 4,
      marginTop: 8,
      borderRadius: 2,
      backgroundColor: theme.palette.surface.borderStrong,
    },
    '&.Mui-focusVisible::before': {
      backgroundColor: theme.palette.focus,
    },
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
}));

// Snap to the nearest of the three heights, leaning towards the way the finger moved.
export const snapState = (height, heights, moved = 0) => {
  // A flick up (moved > 0) counts as a little higher, a flick down as a little lower.
  let lean = 0;
  if (moved > 24) lean = 40;
  else if (moved < -24) lean = -40;
  let best = 'peek';
  let distance = Infinity;
  SHEET_STATES.forEach((state) => {
    const gap = Math.abs(height + lean - heights[state]);
    if (gap < distance) {
      best = state;
      distance = gap;
    }
  });
  return best;
};

// LIV-09: a sheet at the bottom of a phone screen with three heights: a peek (the handle and the
// main actions), half the screen and almost all of it. It follows the finger 1:1 and snaps in
// 260ms. The grabber is also a button, for the keyboard and screen readers.
//
// `handle` (the title) and `peek` (the actions) are always shown; `children` scroll below them.
const BottomSheet = ({ handle, peek, children, className, sheetRef, topInset = 64 }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const rootRef = useRef(null);
  const topRef = useRef(null);
  const dragRef = useRef(null);
  const [state, setState] = useState('peek');
  const [dragHeight, setDragHeight] = useState(null);
  const [heights, setHeights] = useState({ peek: 148, half: 360, full: 560 });

  useLayoutEffect(() => {
    const measure = () => {
      const peekHeight = topRef.current?.offsetHeight || 148;
      const bottom = rootRef.current?.getBoundingClientRect().bottom || window.innerHeight;
      const full = Math.max(peekHeight, bottom - topInset);
      const half = Math.min(full, Math.max(peekHeight, Math.round(window.innerHeight * 0.5)));
      setHeights({ peek: peekHeight, half, full });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (topRef.current) observer?.observe(topRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [topInset]);

  useEffect(() => {
    if (sheetRef) sheetRef(rootRef.current);
    return () => sheetRef?.(null);
  }, [sheetRef]);

  const onPointerDown = (event) => {
    if (event.button > 0 || event.target.closest('button:not([data-grabber]), a, input')) {
      return;
    }
    dragRef.current = {
      id: event.pointerId,
      startY: event.clientY,
      startHeight: heights[state],
      moved: false,
    };
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    if (!drag.moved && Math.abs(delta) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDragHeight(Math.min(Math.max(drag.startHeight + delta, heights.peek), heights.full));
  };
  const onPointerUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    const height = Math.min(
      Math.max(drag.startHeight + (drag.startY - event.clientY), heights.peek),
      heights.full,
    );
    setState(snapState(height, heights, drag.startY - event.clientY));
    setDragHeight(null);
  };

  const next = SHEET_STATES[(SHEET_STATES.indexOf(state) + 1) % SHEET_STATES.length];
  const height = dragHeight ?? heights[state];
  const animate = dragHeight == null && !prefersReducedMotion();

  return (
    <div
      ref={rootRef}
      className={cx(classes.sheet, className)}
      data-sheet={state}
      style={{
        height,
        transition: animate ? `height ${SNAP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
      }}
    >
      <div ref={topRef} className={classes.top}>
        <div
          className={classes.handle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <ButtonBase
            data-grabber
            className={classes.grabber}
            aria-label={t(state === 'full' ? 'sheetCollapse' : 'sheetExpand')}
            aria-expanded={state !== 'peek'}
            onClick={() => setState(next)}
          />
          {handle}
        </div>
        {peek}
      </div>
      <div className={classes.body} hidden={state === 'peek' && dragHeight == null}>
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;

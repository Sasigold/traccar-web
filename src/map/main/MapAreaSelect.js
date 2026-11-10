import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { devicesActions } from '../../store';
import { addToPick, positionsInBox } from './areaSelect';

// LIV-25: while vehicles are being picked, Shift + drag on the map draws a box and picks the
// vehicles inside it (instead of MapLibre's box zoom). Released Shift or a click without drag
// leaves the map as it was.
const MapAreaSelect = ({ positions }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const picked = useSelector((state) => state.devices.picked);
  const picking = picked != null;
  // Live updates must not restart a drag: the latest values are read when it ends.
  const latestRef = useRef({ positions, picked });
  latestRef.current = { positions, picked };

  useEffect(() => {
    if (!picking) return undefined;
    const container = map.getCanvasContainer();
    map.boxZoom.disable();
    let start = null;
    let box = null;

    const point = (event) => {
      const rect = container.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMove = (event) => {
      if (!start) return;
      const current = point(event);
      if (!box) {
        box = document.createElement('div');
        box.setAttribute('aria-hidden', 'true');
        Object.assign(box.style, {
          position: 'absolute',
          pointerEvents: 'none',
          border: `2px solid ${theme.palette.brand.aqua}`,
          background: theme.palette.action.hover,
          borderRadius: '4px',
          zIndex: 2,
        });
        container.appendChild(box);
      }
      Object.assign(box.style, {
        left: `${Math.min(start.x, current.x)}px`,
        top: `${Math.min(start.y, current.y)}px`,
        width: `${Math.abs(current.x - start.x)}px`,
        height: `${Math.abs(current.y - start.y)}px`,
      });
    };

    const onUp = (event) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      map.dragPan.enable();
      if (box) {
        const end = point(event);
        const a = map.unproject([start.x, start.y]);
        const b = map.unproject([end.x, end.y]);
        const ids = positionsInBox(latestRef.current.positions, a, b);
        if (ids.length) {
          dispatch(devicesActions.setPicked(addToPick(latestRef.current.picked, ids)));
        }
        box.remove();
        box = null;
      }
      start = null;
    };

    const onDown = (event) => {
      if (!event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      map.dragPan.disable();
      start = point(event);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    container.addEventListener('mousedown', onDown, true);
    return () => {
      container.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      box?.remove();
      map.dragPan.enable();
      map.boxZoom.enable();
    };
  }, [picking, dispatch, theme]);

  return null;
};

export default MapAreaSelect;

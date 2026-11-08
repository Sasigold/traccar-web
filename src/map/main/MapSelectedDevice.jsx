import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { Button } from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { useTranslation } from '../../common/components/LocalizationProvider';
import {
  getStatusCardRect,
  subscribeStatusCard,
  uncoveredOffset,
} from '../../common/components/statusCardArea';
import { map } from '../core/MapView';
import { usePrevious } from '../../reactHelper';
import { useAttributePreference } from '../../common/util/preferences';
import { toMapCoordinates } from '../core/mapUtil';
import { createTrack, retargetTrack, trackCoordinates } from '../core/motion';
import { prefersReducedMotion } from '../core/movingIcon';

// Selecting a vehicle (on the map or in the list) locks the camera onto it: the map slides under
// the vehicle so it stays at the same spot on screen, frame by frame, in step with the marker's
// glide (both are fed the same fixes, see motion.js). Zooming and rotating keep the lock; dragging
// the map with one finger or the mouse releases it; the "back to vehicle" button that then
// appears (or selecting the vehicle again) re-locks. Closing the vehicle card keeps the lock: the
// vehicle moves to the middle of the map, and stays clear of the card while it is open.
// With the "map follows the selected vehicle" preference off, the map only centers once.
const MapSelectedDevice = () => {
  const t = useTranslation();
  const currentTime = useSelector((state) => state.devices.selectTime);
  const currentId = useSelector((state) => state.devices.selectedId);
  const previousTime = usePrevious(currentTime);
  const previousId = usePrevious(currentId);

  const selectZoom = useAttributePreference('web.selectZoom', 10);
  const mapFollow = useAttributePreference('mapFollow', true);

  const position = useSelector((state) => state.session.positions[currentId]);

  const followingRef = useRef(false);
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  // Vertical screen offset of the followed vehicle from the map's center: the middle of the part
  // of the map the vehicle card leaves uncovered, wherever the card sits (see statusCardArea).
  const offsetRef = useRef(0);
  const pointerDownRef = useRef(false);
  const [released, setReleased] = useState(false);

  // Put the followed vehicle back on its spot: easeTo for a soft settle after a gesture or the
  // initial fly-in, jumpTo for the per-frame glide.
  const centerOn = (coordinates, duration) => {
    const point = map.project(toMapCoordinates(coordinates.longitude, coordinates.latitude));
    const center = map.unproject([point.x, point.y - offsetRef.current]);
    if (duration) {
      map.easeTo({ center, duration });
    } else {
      map.jumpTo({ center });
    }
  };

  const shownCoordinates = () =>
    trackRef.current &&
    (trackCoordinates(trackRef.current, performance.now()) ?? trackRef.current.target);

  const stopLoop = () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  // Per-frame follow while the vehicle glides. Frames where the map is already moving (the
  // fly-in, a pinch or wheel zoom in progress) or a finger or mouse button is down are skipped,
  // so the camera never fights or cancels a gesture.
  const startLoop = () => {
    if (frameRef.current != null) {
      return;
    }
    const step = () => {
      frameRef.current = null;
      if (!followingRef.current || !trackRef.current) {
        return;
      }
      const coordinates = shownCoordinates();
      if (!map.isMoving() && !pointerDownRef.current) {
        centerOn(coordinates);
      }
      if (trackRef.current.start != null) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
  };

  const measureOffset = () =>
    uncoveredOffset(map.getContainer().getBoundingClientRect(), getStatusCardRect());

  // The card opened, closed, grew or was dragged: move the followed vehicle into the uncovered
  // part of the map.
  useEffect(() => {
    const update = () => {
      const next = measureOffset();
      if (Math.abs(next - offsetRef.current) < 1) {
        return;
      }
      offsetRef.current = next;
      if (followingRef.current && trackRef.current && !map.isMoving() && !pointerDownRef.current) {
        centerOn(shownCoordinates(), prefersReducedMotion() ? 0 : 300);
        startLoop();
      }
    };
    const unsubscribe = subscribeStatusCard(update);
    window.addEventListener('resize', update);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDragStart = (event) => {
      const touches = event.originalEvent?.touches;
      if (touches && touches.length > 1) {
        return; // two-finger pinch or rotate, not a pan away from the vehicle
      }
      if (followingRef.current && trackRef.current) {
        setReleased(true);
      }
      followingRef.current = false;
      stopLoop();
    };
    // While a finger or the mouse button is down the user may be starting a drag: settling then
    // would cancel the gesture (camera moves stop map handlers), e.g. grabbing during the fly-in.
    const onPointerDown = () => {
      pointerDownRef.current = true;
    };
    const onPointerUp = () => {
      pointerDownRef.current = false;
    };
    const onMoveEnd = (event) => {
      // After a user zoom or rotate, or after the fly-in, settle back onto the vehicle.
      if (
        followingRef.current &&
        trackRef.current &&
        !pointerDownRef.current &&
        (event.originalEvent || event.followSettle)
      ) {
        centerOn(shownCoordinates(), prefersReducedMotion() ? 0 : 250);
        startLoop();
      }
    };
    const container = map.getContainer();
    container.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    map.on('dragstart', onDragStart);
    map.on('moveend', onMoveEnd);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      map.off('dragstart', onDragStart);
      map.off('moveend', onMoveEnd);
      stopLoop();
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentId) {
      followingRef.current = false;
      trackRef.current = null;
      stopLoop();
      setReleased(false);
      return;
    }
    if (!position) {
      return;
    }
    const selected = currentId !== previousId || currentTime !== previousTime;
    if (selected) {
      offsetRef.current = measureOffset();
      followingRef.current = mapFollow;
      setReleased(false);
      trackRef.current = createTrack(position);
      stopLoop();
      map.easeTo(
        {
          center: toMapCoordinates(position.longitude, position.latitude),
          zoom: Math.max(map.getZoom(), selectZoom),
          offset: [0, offsetRef.current],
        },
        { followSettle: true },
      );
    } else if (trackRef.current && trackRef.current.target !== position) {
      retargetTrack(trackRef.current, position, performance.now(), !prefersReducedMotion());
      if (followingRef.current) {
        startLoop();
      }
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [currentId, previousId, currentTime, previousTime, mapFollow, position, selectZoom]);

  const relock = () => {
    followingRef.current = true;
    setReleased(false);
    centerOn(shownCoordinates(), prefersReducedMotion() ? 0 : 400);
    startLoop();
  };

  if (!released) {
    return null;
  }

  // Centered over the visible part of the map (the side panel pads one side of it). Physical
  // left on purpose: it is computed from the map's own padding and must not flip in RTL.
  const padding = map.getPadding();
  const style = {
    position: 'absolute',
    top: 16,
    left: `calc(${padding.left}px + (100% - ${padding.left + padding.right}px) / 2)`,
    transform: 'translateX(-50%)',
    zIndex: 2,
  };

  return createPortal(
    <div style={style}>
      <Button
        onClick={relock}
        startIcon={<CenterFocusStrongIcon />}
        sx={(theme) => ({
          borderRadius: 999,
          paddingInline: 2,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: theme.shadows[3],
          whiteSpace: 'nowrap',
          '&:hover': { backgroundColor: theme.palette.background.paper },
        })}
      >
        {t('mapBackToVehicle')}
      </Button>
    </div>,
    map.getContainer(),
  );
};

export default MapSelectedDevice;

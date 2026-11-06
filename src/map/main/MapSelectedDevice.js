import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import useFeatures from '../../common/util/useFeatures';
import dimensions from '../../common/theme/dimensions';
import { map } from '../core/MapView';
import { usePrevious } from '../../reactHelper';
import { useAttributePreference } from '../../common/util/preferences';
import { toMapCoordinates } from '../core/mapUtil';
import { createTrack, retargetTrack, trackCoordinates } from '../core/motion';
import { prefersReducedMotion } from '../core/movingIcon';

// Selecting a vehicle (on the map or in the list) locks the camera onto it: the map slides under
// the vehicle so it stays at the same spot on screen, frame by frame, in step with the marker's
// glide (both are fed the same fixes, see motion.js). Zooming and rotating keep the lock; dragging
// the map with one finger or the mouse releases it, and selecting the vehicle again re-locks.
// With the "map follows the selected vehicle" preference off, the map only centers once.
const MapSelectedDevice = () => {
  const features = useFeatures();
  const currentTime = useSelector((state) => state.devices.selectTime);
  const currentId = useSelector((state) => state.devices.selectedId);
  const previousTime = usePrevious(currentTime);
  const previousId = usePrevious(currentId);

  const selectZoom = useAttributePreference('web.selectZoom', 10);
  const mapFollow = useAttributePreference('mapFollow', true);

  const position = useSelector((state) => state.session.positions[currentId]);

  // The vehicle sits above the true center so the status card does not cover it.
  const offsetY = features.disableStatusCard ? 0 : -dimensions.popupMapOffset / 2;

  const followingRef = useRef(false);
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  const offsetRef = useRef(offsetY);
  offsetRef.current = offsetY;

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
  // fly-in, a pinch or wheel zoom in progress) are skipped so the camera never fights a gesture.
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
      if (!map.isMoving()) {
        centerOn(coordinates);
      }
      if (trackRef.current.start != null) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const onDragStart = (event) => {
      const touches = event.originalEvent?.touches;
      if (touches && touches.length > 1) {
        return; // two-finger pinch or rotate, not a pan away from the vehicle
      }
      followingRef.current = false;
      stopLoop();
    };
    const onMoveEnd = (event) => {
      // After a user zoom or rotate, or after the fly-in, settle back onto the vehicle.
      if (followingRef.current && trackRef.current && (event.originalEvent || event.followSettle)) {
        centerOn(shownCoordinates(), prefersReducedMotion() ? 0 : 250);
        startLoop();
      }
    };
    map.on('dragstart', onDragStart);
    map.on('moveend', onMoveEnd);
    return () => {
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
      return;
    }
    if (!position) {
      return;
    }
    const selected = currentId !== previousId || currentTime !== previousTime;
    if (selected) {
      followingRef.current = mapFollow;
      trackRef.current = createTrack(position);
      stopLoop();
      map.easeTo(
        {
          center: toMapCoordinates(position.longitude, position.latitude),
          zoom: Math.max(map.getZoom(), selectZoom),
          offset: [0, offsetY],
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
  }, [currentId, previousId, currentTime, previousTime, mapFollow, position, selectZoom, offsetY]);

  return null;
};

export default MapSelectedDevice;

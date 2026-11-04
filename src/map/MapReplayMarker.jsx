import { useEffect, useRef, useState } from 'react';
import { map } from './core/MapView';
import MapPositionMarkers from './MapPositionMarkers';
import { interpolateCoordinates, replaySegmentDuration } from './core/motion';
import { prefersReducedMotion } from './core/movingIcon';
import { toMapCoordinates } from './core/mapUtil';

const FOLLOW_EASE = 600; // ms, the camera glides onto the vehicle when playback starts

// The replay vehicle. While playing it drives along the route at a pace derived from the real
// timestamps, and the camera follows it until the user moves the map by hand. `index` is the
// point the vehicle has passed; the owner is told each time it reaches the next one.
const MapReplayMarker = ({ positions, index, playing, onIndexChange, onMarkerClick }) => {
  const progressRef = useRef(index);
  const followRef = useRef(true);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const [shown, setShown] = useState(() => positions[index]);

  const animate = !prefersReducedMotion();

  useEffect(() => {
    if (Math.floor(progressRef.current) !== index) {
      progressRef.current = index;
    }
    if (!playing) {
      setShown(positions[index]);
    }
  }, [positions, index, playing]);

  useEffect(() => {
    if (!playing || positions.length < 2) {
      return undefined;
    }

    followRef.current = true;
    const center = (position) => toMapCoordinates(position.longitude, position.latitude);
    // Glide the camera onto the vehicle first; per-frame jumps start once that ease is over.
    let easing = true;
    map.once('moveend', () => {
      easing = false;
    });
    map.easeTo({
      center: center(positions[Math.floor(progressRef.current)]),
      duration: FOLLOW_EASE,
    });

    const onMoveStart = (event) => {
      if (event.originalEvent) {
        followRef.current = false;
      }
    };
    map.on('movestart', onMoveStart);

    let last = performance.now();
    let frame;
    const step = (now) => {
      const elapsed = now - last;
      last = now;
      let current = Math.floor(progressRef.current);
      if (current >= positions.length - 1) {
        return;
      }
      const duration = replaySegmentDuration(positions[current], positions[current + 1]);
      const progress = Math.min(progressRef.current + elapsed / duration, current + 1);
      progressRef.current = progress;
      const reached = Math.floor(progress);
      if (reached !== current) {
        current = reached;
        onIndexChangeRef.current?.(reached);
      }
      const from = positions[current];
      const to = positions[Math.min(current + 1, positions.length - 1)];
      const position = animate
        ? { ...from, ...interpolateCoordinates(from, to, progress - current) }
        : from;
      setShown(position);
      if (followRef.current && !easing) {
        map.jumpTo({ center: center(position) });
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      map.off('movestart', onMoveStart);
    };
  }, [playing, positions, animate]);

  if (!shown) {
    return null;
  }
  return (
    <MapPositionMarkers positions={[shown]} onMarkerClick={onMarkerClick} titleField="fixTime" />
  );
};

export default MapReplayMarker;

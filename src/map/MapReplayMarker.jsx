import { useEffect, useRef, useState } from 'react';
import { map } from './core/MapView';
import MapPositionMarkers from './MapPositionMarkers';
import { interpolateCoordinates, replaySegmentDuration } from './core/motion';
import { prefersReducedMotion } from './core/movingIcon';
import { toMapCoordinates } from './core/mapUtil';

const FOLLOW_EASE = 600; // ms, the camera glides onto the vehicle when playback starts

// The replay vehicle. While playing it drives along the route at a pace derived from the real
// timestamps times `speed`, and the camera follows it until the user moves the map by hand.
// `index` is the point the vehicle has passed; the owner is told each time it reaches the next one.
const MapReplayMarker = ({
  positions,
  index,
  playing,
  speed = 1,
  onIndexChange,
  onMarkerClick,
}) => {
  const progressRef = useRef(index);
  const followRef = useRef(true);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const speedRef = useRef(speed);
  speedRef.current = speed;

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
      let remaining = now - last;
      last = now;
      const started = Math.floor(progressRef.current);
      if (started >= positions.length - 1) {
        return;
      }
      // Spend the frame's time along the route, crossing several points when the pace is fast.
      let current = started;
      let progress = progressRef.current;
      while (remaining > 0 && current < positions.length - 1) {
        const duration =
          replaySegmentDuration(positions[current], positions[current + 1]) / speedRef.current;
        const left = (current + 1 - progress) * duration;
        if (remaining < left) {
          progress += remaining / duration;
          remaining = 0;
        } else {
          remaining -= left;
          current += 1;
          progress = current;
        }
      }
      progressRef.current = progress;
      if (current !== started) {
        onIndexChangeRef.current?.(current);
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

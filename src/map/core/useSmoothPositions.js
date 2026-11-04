import { useEffect, useMemo, useReducer, useRef } from 'react';
import { interpolateCoordinates, liveTransitionDuration } from './motion';
import { prefersReducedMotion } from './movingIcon';

// Glide live markers between GPS fixes instead of jumping. Each device keeps a track: the fix it is
// heading to, the point it started from and when. A new fix that arrives mid-glide starts from
// wherever the marker is shown right now, so it never jumps back. Returns the positions with the
// shown coordinates swapped in; everything else (id, speed, attributes) stays the latest fix.
const useSmoothPositions = (positions, enabled = true) => {
  const tracks = useRef(new Map()).current;
  const [tick, nextFrame] = useReducer((frame) => frame + 1, 0);

  const animate = enabled && !prefersReducedMotion();

  const shown = useMemo(() => {
    const now = performance.now();
    const seen = new Set();
    const result = positions.map((position) => {
      seen.add(position.deviceId);
      let track = tracks.get(position.deviceId);
      if (!track) {
        track = { target: position, start: null };
        tracks.set(position.deviceId, track);
      } else if (track.target !== position) {
        const current =
          track.start == null
            ? track.target
            : interpolateCoordinates(
                track.from,
                track.target,
                (now - track.start) / track.duration,
              );
        const duration = animate ? liveTransitionDuration(track.target, position) : 0;
        track.from = {
          latitude: current.latitude,
          longitude: current.longitude,
          course: current.course,
        };
        track.target = position;
        track.start = duration ? now : null;
        track.duration = duration;
      }
      if (track.start == null) {
        return position;
      }
      const progress = (now - track.start) / track.duration;
      if (progress >= 1) {
        track.start = null;
        return position;
      }
      return { ...position, ...interpolateCoordinates(track.from, track.target, progress) };
    });
    tracks.forEach((_, deviceId) => {
      if (!seen.has(deviceId)) {
        tracks.delete(deviceId);
      }
    });
    return result;
    // tick re-evaluates the glides each animation frame
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [positions, animate, tick]);

  useEffect(() => {
    let gliding = false;
    tracks.forEach((track) => {
      if (track.start != null) {
        gliding = true;
      }
    });
    if (!gliding) {
      return undefined;
    }
    const frame = requestAnimationFrame(nextFrame);
    return () => cancelAnimationFrame(frame);
  });

  return shown;
};

export default useSmoothPositions;

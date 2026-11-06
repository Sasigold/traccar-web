// Smooth vehicle motion: pure helpers shared by the live map (markers glide from one GPS fix to
// the next) and the replay page (the marker drives along the route instead of hopping between
// points). Everything here is frame-rate independent: callers pass a progress fraction 0..1.

// Live view: a new fix is reached in the time the device took between fixes, so a vehicle that
// reports every 10 s keeps moving for 10 s instead of jumping and standing still.
export const LIVE_MIN_DURATION = 500; // ms, so even rapid reports still glide
export const LIVE_MAX_DURATION = 30000; // ms, longer gaps would lag the live position too much
export const LIVE_SNAP_DISTANCE = 5000; // m, farther jumps are not driving: teleport instead
export const LIVE_SNAP_GAP = 5 * 60 * 1000; // ms between fixes: the device was offline, teleport

// Replay: real time compressed by this factor, so one hour of driving plays in three minutes
// (the same pace as the old fixed 500 ms per point for a 10 s reporting interval).
export const REPLAY_TIME_SCALE = 20;
export const REPLAY_MIN_SEGMENT = 100; // ms, dense tracks still advance visibly per frame
export const REPLAY_MAX_SEGMENT = 2000; // ms, parking gaps do not stall the playback

const EARTH_RADIUS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (from, to, t) => from + (to - from) * t;

// Interpolate a bearing in degrees along the shortest arc; the result is normalized to [0, 360).
export const lerpAngle = (from, to, t) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (((from + delta * t) % 360) + 360) % 360;
};

// Haversine distance in meters between two positions.
export const distanceMeters = (from, to) => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
};

export const sameCoordinates = (a, b) =>
  a.latitude === b.latitude && a.longitude === b.longitude && (a.course ?? 0) === (b.course ?? 0);

// Coordinates and heading at fraction t of the way from one position to the next. The result
// carries only the moving fields; the caller spreads it over whichever position it is based on.
export const interpolateCoordinates = (from, to, t) => {
  const fraction = clamp(t, 0, 1);
  return {
    latitude: lerp(from.latitude, to.latitude, fraction),
    longitude: lerp(from.longitude, to.longitude, fraction),
    course: lerpAngle(from.course ?? 0, to.course ?? 0, fraction),
  };
};

const fixTimeGap = (from, to) => {
  const gap = new Date(to.fixTime) - new Date(from.fixTime);
  return Number.isFinite(gap) ? Math.abs(gap) : 0;
};

// How long the live marker should take to glide from one fix to the next, or 0 to teleport.
export const liveTransitionDuration = (from, to) => {
  if (!from || !to || sameCoordinates(from, to)) {
    return 0;
  }
  const gap = fixTimeGap(from, to);
  if (gap > LIVE_SNAP_GAP || distanceMeters(from, to) > LIVE_SNAP_DISTANCE) {
    return 0;
  }
  return clamp(gap, LIVE_MIN_DURATION, LIVE_MAX_DURATION);
};

// Playback time for one replay segment, derived from the real time the vehicle took.
export const replaySegmentDuration = (from, to) =>
  clamp(fixTimeGap(from, to) / REPLAY_TIME_SCALE, REPLAY_MIN_SEGMENT, REPLAY_MAX_SEGMENT);

// One device's glide between fixes. The live markers (useSmoothPositions) and the follow camera
// (MapSelectedDevice) each keep a track fed with the same fixes, so the camera moves in step with
// the marker and a followed vehicle stays put on screen.
export const createTrack = (position) => ({ target: position, start: null });

// Where the track is shown at time `now` (ms, performance.now()), or null once the glide is over
// and the track rests on its target.
export const trackCoordinates = (track, now) => {
  if (track.start == null) {
    return null;
  }
  const progress = (now - track.start) / track.duration;
  if (progress >= 1) {
    track.start = null;
    return null;
  }
  return interpolateCoordinates(track.from, track.target, progress);
};

// Head for a new fix, starting from wherever the track is shown right now so it never jumps back.
export const retargetTrack = (track, position, now, animate) => {
  const current = trackCoordinates(track, now) ?? track.target;
  const duration = animate ? liveTransitionDuration(track.target, position) : 0;
  track.from = {
    latitude: current.latitude,
    longitude: current.longitude,
    course: current.course,
  };
  track.target = position;
  track.start = duration ? now : null;
  track.duration = duration;
};

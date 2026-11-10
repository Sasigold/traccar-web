// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import useMinuteNow from '../util/useMinuteNow';
import { hiddenReason, isPrivacyActive } from './privacy';

// Live positions without the vehicles whose location is hidden now (outside working hours or in
// a private period), and why each one is hidden. The same object comes back when nothing is.
const useVisiblePositions = (positions) => {
  const privacy = useSelector((state) => state.fleet.privacy);
  const now = useMinuteNow();
  return useMemo(() => {
    if (!isPrivacyActive(privacy)) {
      return { positions, hidden: {} };
    }
    const hidden = {};
    Object.values(positions).forEach((position) => {
      const reason =
        hiddenReason(privacy, position.deviceId, now) ||
        hiddenReason(privacy, position.deviceId, position.fixTime);
      if (reason) {
        hidden[position.deviceId] = reason;
      }
    });
    if (!Object.keys(hidden).length) {
      return { positions, hidden };
    }
    const visible = Object.fromEntries(
      Object.entries(positions).filter(([deviceId]) => !hidden[deviceId]),
    );
    return { positions: visible, hidden };
  }, [positions, privacy, now]);
};

export default useVisiblePositions;

// All live positions a screen may show (the same object as the store when nothing is hidden).
export const useLivePositions = () =>
  useVisiblePositions(useSelector((state) => state.session.positions)).positions;

// One vehicle's live position, or undefined while its location is hidden.
export const useLivePosition = (deviceId) => {
  const position = useSelector((state) => state.session.positions[deviceId]);
  const privacy = useSelector((state) => state.fleet.privacy);
  const now = useMinuteNow();
  if (!position || !isPrivacyActive(privacy)) {
    return position;
  }
  const hidden =
    hiddenReason(privacy, position.deviceId, now) ||
    hiddenReason(privacy, position.deviceId, position.fixTime);
  return hidden ? undefined : position;
};

// Why a vehicle's live location is hidden now ('private', 'hours') or null.
export const useHiddenReason = (deviceId) => {
  const position = useSelector((state) => state.session.positions[deviceId]);
  const privacy = useSelector((state) => state.fleet.privacy);
  const now = useMinuteNow();
  if (deviceId == null || !isPrivacyActive(privacy)) {
    return null;
  }
  return (
    hiddenReason(privacy, Number(deviceId), now) ||
    (position ? hiddenReason(privacy, position.deviceId, position.fixTime) : null)
  );
};

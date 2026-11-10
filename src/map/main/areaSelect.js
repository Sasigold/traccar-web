// LIV-25: the vehicles inside a box drawn on the map. Pure, tested.

// corners: two { lng, lat } in any order.
export const positionsInBox = (positions, a, b) => {
  const west = Math.min(a.lng, b.lng);
  const east = Math.max(a.lng, b.lng);
  const south = Math.min(a.lat, b.lat);
  const north = Math.max(a.lat, b.lat);
  return positions
    .filter(
      (position) =>
        position.longitude >= west &&
        position.longitude <= east &&
        position.latitude >= south &&
        position.latitude <= north,
    )
    .map((position) => position.deviceId);
};

// The pick after a box: what was picked, plus what is in the box, each once.
export const addToPick = (picked, ids) => [...new Set([...(picked || []), ...ids])];

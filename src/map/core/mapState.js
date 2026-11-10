// Map state that plain helpers need without importing the map itself (which would pull MapLibre
// into every page): the coordinate system of the current map style ('gcj02' for Chinese maps).
let coordinateSystem = null;

export const getCoordinateSystem = () => coordinateSystem;

export const setCoordinateSystem = (value) => {
  coordinateSystem = value || null;
};

// FND-10: gcoord (Chinese map coordinates) is loaded only when such a map style is chosen.
let gcoordModule = null;
export const getGcoord = () => gcoordModule;
export const loadGcoord = async () => {
  if (!gcoordModule) gcoordModule = (await import('gcoord')).default;
  return gcoordModule;
};

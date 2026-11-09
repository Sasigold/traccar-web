// Map state that plain helpers need without importing the map itself (which would pull MapLibre
// into every page): the coordinate system of the current map style ('gcj02' for Chinese maps).
let coordinateSystem = null;

export const getCoordinateSystem = () => coordinateSystem;

export const setCoordinateSystem = (value) => {
  coordinateSystem = value || null;
};

import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { map } from '../core/MapView';
import useMapLayer from '../core/useMapLayer';
import { toMapCoordinates } from '../core/mapUtil';
import { prefersReducedMotion } from '../core/movingIcon';
import { useAttributePreference } from '../../common/util/preferences';

// Marker images are 48 px squares; the ring sits just outside the disc.
const MARKER_SIZE = 48;
const PULSE_MS = 700;

// An aqua ring around the selected vehicle's marker, with one pulse when it is selected. Follows
// the shown (gliding) position, so it moves with the marker.
const MapSelectionRing = ({ position }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.75 : 1);
  const selectTime = useSelector((state) => state.devices.selectTime);

  const radius = (MARKER_SIZE / 2) * iconScale + 1;

  const id = useMapLayer({
    layers: [
      {
        type: 'circle',
        paint: {
          'circle-radius': radius,
          'circle-opacity': 0,
          'circle-stroke-color': theme.palette.brand.aqua,
          'circle-stroke-width': 3,
          'circle-pitch-alignment': 'map',
        },
      },
    ],
    layersDeps: [radius, theme.palette.brand.aqua],
    data: {
      type: 'FeatureCollection',
      features: position
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: toMapCoordinates(position.longitude, position.latitude),
              },
              properties: {},
            },
          ]
        : [],
    },
    dataDeps: [position?.longitude, position?.latitude, Boolean(position)],
  });

  // The pulse: the ring starts wide and faint and closes in on the marker.
  useEffect(() => {
    if (!selectTime || prefersReducedMotion() || !map.getLayer(id)) {
      return undefined;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      if (!map.getLayer(id)) {
        return;
      }
      const progress = Math.min((now - start) / PULSE_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      map.setPaintProperty(id, 'circle-radius', radius + 14 * (1 - eased));
      map.setPaintProperty(id, 'circle-stroke-opacity', 0.35 + 0.65 * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      if (map.getLayer(id)) {
        map.setPaintProperty(id, 'circle-radius', radius);
        map.setPaintProperty(id, 'circle-stroke-opacity', 1);
      }
    };
  }, [id, selectTime, radius]);

  return null;
};

export default MapSelectionRing;

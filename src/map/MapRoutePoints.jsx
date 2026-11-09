import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';
import useMapLayer from './core/useMapLayer';
import getSpeedColor from '../common/util/colors';
import { findFonts, toMapCoordinates } from './core/mapUtil';
import MapSpeedLegend from './control/MapSpeedLegend';

const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
const onMouseLeave = () => (map.getCanvas().style.cursor = '');

const MapRoutePoints = ({ positions, onClick, showSpeedControl }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const speedLimit = useSelector((state) => {
    const deviceId = positions?.find(() => true)?.deviceId;
    return Number(state.devices.items[deviceId]?.attributes?.speedLimit) || 0;
  });
  const onMarkerClick = useCallback(
    (event) => {
      event.preventDefault();
      const feature = event.features[0];
      if (onClick) {
        onClick(feature.properties.id, feature.properties.index);
      }
    },
    [onClick],
  );

  const maxSpeed = positions.reduce((a, p) => Math.max(a, p.speed), -Infinity);
  const minSpeed = positions.reduce((a, p) => Math.min(a, p.speed), Infinity);

  useMapLayer({
    layers: [
      {
        type: 'symbol',
        paint: {
          'text-color': ['get', 'color'],
        },
        layout: {
          'text-font': findFonts(map),
          'text-size': 12,
          'text-field': '▲',
          'text-allow-overlap': true,
          'text-rotate': ['get', 'rotation'],
        },
        on: {
          mouseenter: onMouseEnter,
          mouseleave: onMouseLeave,
          click: onMarkerClick,
        },
      },
    ],
    layersDeps: [onMarkerClick],
    data: {
      type: 'FeatureCollection',
      features: positions.map((position, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: toMapCoordinates(position.longitude, position.latitude),
        },
        properties: {
          index,
          id: position.id,
          rotation: position.course,
          color: getSpeedColor(position.speed, minSpeed, maxSpeed, { dark, limit: speedLimit }),
        },
      })),
    },
    dataDeps: [positions, dark, speedLimit],
  });

  return showSpeedControl ? <MapSpeedLegend positions={positions} speedLimit={speedLimit} /> : null;
};

export default MapRoutePoints;

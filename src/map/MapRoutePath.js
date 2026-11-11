// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMapLayer from './core/useMapLayer';
import getSpeedColor from '../common/util/colors';
import { useAttributePreference } from '../common/util/preferences';
import { toMapCoordinates } from './core/mapUtil';
import { casingLayer } from './core/lineCasing';

const MapRoutePath = ({ positions }) => {
  const theme = useTheme();
  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return null;
  });

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  const speedLimit = useSelector((state) => {
    const deviceId = positions?.find(() => true)?.deviceId;
    return Number(state.devices.items[deviceId]?.attributes?.speedLimit) || 0;
  });
  const dark = theme.palette.mode === 'dark';

  const minSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.min(a, b), Infinity);
  const maxSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.max(a, b), -Infinity);
  const features = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          toMapCoordinates(positions[i].longitude, positions[i].latitude),
          toMapCoordinates(positions[i + 1].longitude, positions[i + 1].latitude),
        ],
      },
      properties: {
        color:
          reportColor ||
          getSpeedColor(positions[i + 1].speed, minSpeed, maxSpeed, {
            dark,
            // SAF-06: the road's limit where Traccar knows it, else the vehicle's.
            limit: Number(positions[i + 1].attributes?.speedLimit) || speedLimit,
          }),
        width: mapLineWidth,
        opacity: mapLineOpacity,
      },
    });
  }

  useMapLayer({
    layers: [
      casingLayer(theme),
      {
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      },
    ],
    layersDeps: [theme.palette.mode],
    data: {
      type: 'FeatureCollection',
      features,
    },
    dataDeps: [positions, reportColor, mapLineWidth, mapLineOpacity],
  });

  return null;
};

export default MapRoutePath;

import { useMemo } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import useMapLayer from './core/useMapLayer';
import { toMapCoordinates } from './core/mapUtil';

// LIV-27: points as a density map, in the brand's continuous scale (ice, aqua, navy; on dark,
// navy to aqua). Each point may carry a weight (for example the hours of a stop).
const MapHeatmap = ({ points }) => {
  const theme = useTheme();
  const [low, middle, high] = theme.palette.dataviz.heatmap;
  const weighted = points.some((point) => point.weight != null);
  const maxWeight = weighted ? Math.max(...points.map((point) => point.weight || 0), 1) : 1;

  const data = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: points.map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: toMapCoordinates(point.longitude, point.latitude),
        },
        properties: { weight: weighted ? (point.weight || 0) / maxWeight : 1 },
      })),
    }),
    [points, weighted, maxWeight],
  );

  useMapLayer({
    layers: [
      {
        type: 'heatmap',
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 28],
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            alpha(low, 0),
            0.15,
            low,
            0.55,
            middle,
            1,
            high,
          ],
        },
      },
    ],
    layersDeps: [low, middle, high],
    data,
    dataDeps: [data],
  });

  return null;
};

export default MapHeatmap;

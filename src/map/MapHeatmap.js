import { useMemo } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import useMapLayer from './core/useMapLayer';
import { map } from './core/MapView';
import { toMapCoordinates } from './core/mapUtil';

// LIV-27: points as a density map, in the brand's continuous scale (ice, aqua, navy; on dark,
// navy to aqua). Each point may carry a weight (for example the hours of a stop).
// `underLabels` draws it under the map's labels and every layer of ours (the live map's markers).
const firstSymbolLayer = () => map.getStyle()?.layers?.find((layer) => layer.type === 'symbol')?.id;

const MapHeatmap = ({ points, underLabels = false }) => {
  const theme = useTheme();
  // The brand's palette extensions are not in MUI's Palette type.
  const [low, middle, high] = /** @type {any} */ (theme.palette).dataviz.heatmap;
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
        beforeId: underLabels ? firstSymbolLayer : undefined,
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
    layersDeps: [low, middle, high, underLabels],
    data,
    dataDeps: [data],
  });

  return null;
};

export default MapHeatmap;

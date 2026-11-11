// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import useMapLayer from '../core/useMapLayer';
import { toMapCoordinates } from '../core/mapUtil';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useStableArray } from '../../common/util/stableArray';
import { accuracyRadiusExpression, accuracyRadiusAtZoomZero } from './accuracyRadius';

// PRF-05: one point per position, drawn as a circle whose radius follows the zoom, instead of
// a 64-vertex polygon per position rebuilt on every update.
const MapAccuracy = ({ positions }) => {
  const theme = useTheme();
  const t = useTranslation();

  const accurate = useStableArray(positions.filter((position) => position.accuracy > 0));
  const features = useMemo(
    () =>
      accurate.map((position) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: toMapCoordinates(position.longitude, position.latitude),
        },
        properties: { r0: accuracyRadiusAtZoomZero(position.accuracy, position.latitude) },
      })),
    [accurate],
  );

  useMapLayer({
    layers: [
      {
        type: 'circle',
        metadata: { 'traccar:title': t('positionAccuracy') },
        paint: {
          'circle-radius': accuracyRadiusExpression,
          'circle-color': theme.palette.geometry.main,
          'circle-opacity': 0.25,
          'circle-stroke-color': theme.palette.geometry.main,
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.6,
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map',
        },
      },
    ],
    layersDeps: [t, theme.palette.geometry.main],
    data: { type: 'FeatureCollection', features },
    dataDeps: [features],
  });

  return null;
};

export default MapAccuracy;

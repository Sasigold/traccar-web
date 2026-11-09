import { useMemo } from 'react';
import turfCircle from '@turf/circle';
import { useTheme } from '@mui/material/styles';
import useMapLayer from '../core/useMapLayer';
import { toMapCoordinates } from '../core/mapUtil';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useStableArray } from '../../common/util/stableArray';

const MapAccuracy = ({ positions }) => {
  const theme = useTheme();
  const t = useTranslation();

  // Only positions with an accuracy circle; the circles are rebuilt only when one of them moved.
  const accurate = useStableArray(positions.filter((position) => position.accuracy > 0));
  const features = useMemo(
    () =>
      accurate.map((position) =>
        turfCircle(
          toMapCoordinates(position.longitude, position.latitude),
          position.accuracy * 0.001,
        ),
      ),
    [accurate],
  );

  useMapLayer({
    layers: [
      {
        type: 'fill',
        filter: ['all', ['==', '$type', 'Polygon']],
        metadata: { 'traccar:title': t('positionAccuracy') },
        paint: {
          'fill-color': theme.palette.geometry.main,
          'fill-outline-color': theme.palette.geometry.main,
          'fill-opacity': 0.25,
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

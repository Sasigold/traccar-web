// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMapLayer from '../core/useMapLayer';
import { useAttributePreference } from '../../common/util/preferences';
import { toMapCoordinates } from '../core/mapUtil';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { casingLayer } from '../core/lineCasing';

const NO_FEATURES = [];

const MapLiveRoutes = ({ deviceIds }) => {
  const theme = useTheme();
  const t = useTranslation();

  const type = useAttributePreference('mapLiveRoutes', 'none');

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const history = useSelector((state) => state.session.history);

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  // PRF-05: the routes are built only when something they show changed, and not at all while
  // they are off (the source then keeps one empty list, so it is not set again).
  const features = useMemo(() => {
    if (type === 'none') return NO_FEATURES;
    return deviceIds
      .filter((id) => (type === 'selected' ? id === selectedDeviceId : true))
      .filter((id) => history.hasOwnProperty(id))
      .filter((id) => devices[id])
      .map((deviceId) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: history[deviceId].map(([longitude, latitude]) =>
            toMapCoordinates(longitude, latitude),
          ),
        },
        properties: {
          color: devices[deviceId]?.attributes?.['web.reportColor'] || theme.palette.geometry.main,
          width: mapLineWidth,
          opacity: mapLineOpacity,
        },
      }));
  }, [
    type,
    deviceIds,
    selectedDeviceId,
    history,
    devices,
    theme.palette.geometry.main,
    mapLineWidth,
    mapLineOpacity,
  ]);

  useMapLayer({
    layers: [
      casingLayer(theme),
      {
        type: 'line',
        metadata: { 'traccar:title': t('mapLiveRoutes') },
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
    layersDeps: [t, theme.palette.mode],
    data: { type: 'FeatureCollection', features },
    dataDeps: [features],
  });

  return null;
};

export default MapLiveRoutes;

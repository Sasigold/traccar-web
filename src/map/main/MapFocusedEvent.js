// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { map } from '../core/MapView';
import useMapLayer from '../core/useMapLayer';
import { toMapCoordinates } from '../core/mapUtil';
import { eventIconKey } from '../core/preloadImages';
import { prefersReducedMotion } from '../core/movingIcon';
import { useAttributePreference } from '../../common/util/preferences';
import { eventSeverity } from '../../common/util/eventSeverity';
import fetchOrThrow from '../../common/util/fetchOrThrow';

// Where the alert opened from the alerts list happened: its icon in a ring on the map (red for
// critical, amber for warnings). "Event location" on the card flies there.
const MapFocusedEvent = () => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.75 : 1);
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');
  const soundEvents = useAttributePreference('soundEvents', '');
  const event = useSelector((state) => state.events.focused);
  const locateTime = useSelector((state) => state.events.locateTime);
  const [position, setPosition] = useState(null);

  const positionId = event?.positionId;
  useEffect(() => {
    setPosition(null);
    if (!positionId) {
      return undefined;
    }
    const controller = new AbortController();
    fetchOrThrow(`api/positions?id=${positionId}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((items) => setPosition(items.find((item) => item.id === positionId) || items[0]))
      .catch(() => {});
    return () => controller.abort();
  }, [positionId]);

  const severity = eventSeverity(event, { soundAlarms, soundEvents });
  const color =
    severity === 'critical'
      ? theme.palette.error.main
      : severity === 'warning'
        ? theme.palette.warning.main
        : theme.palette.primary.main;

  useMapLayer({
    layers: [
      {
        key: 'ring',
        type: 'circle',
        paint: {
          'circle-radius': 24 * iconScale + 2,
          'circle-opacity': 0,
          'circle-stroke-color': color,
          'circle-stroke-width': 3,
        },
      },
      {
        key: 'icon',
        type: 'symbol',
        layout: {
          'icon-image': ['get', 'image'],
          'icon-size': iconScale,
          'icon-allow-overlap': true,
        },
      },
    ],
    layersDeps: [iconScale, color],
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
              properties: { image: eventIconKey(event?.type) },
            },
          ]
        : [],
    },
    dataDeps: [position, event?.type],
  });

  useEffect(() => {
    if (locateTime && position) {
      map.easeTo({
        center: toMapCoordinates(position.longitude, position.latitude),
        zoom: Math.max(map.getZoom(), 15),
        duration: prefersReducedMotion() ? 0 : 600,
      });
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [locateTime, position?.id]);

  return null;
};

export default MapFocusedEvent;

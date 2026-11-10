import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMapLayer from '../core/useMapLayer';
import { useAttributePreference } from '../../common/util/preferences';
import { toMapCoordinates } from '../core/mapUtil';
import { casingLayer } from '../core/lineCasing';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useAsyncTask } from '../../reactHelper';
import { TRAIL_MINUTES, trailPoints } from './trail';

// LIV-12: where the selected vehicle was in the last ten minutes, as a short trail behind it,
// when live routes are off (the default). Loaded once on selection, then extended by its live
// positions.
const MapSelectedTrail = () => {
  const theme = useTheme();
  const liveRoutes = useAttributePreference('mapLiveRoutes', 'none');
  const selectedId = useSelector((state) => state.devices.selectedId);
  const live = useSelector((state) => (selectedId ? state.session.positions[selectedId] : null));
  const [history, setHistory] = useState([]);
  const [tick, setTick] = useState(0);
  const enabled = liveRoutes === 'none' && Boolean(selectedId);

  useAsyncTask(
    async ({ signal }) => {
      setHistory([]);
      if (!enabled) return;
      const to = new Date();
      const query = new URLSearchParams({
        deviceId: selectedId,
        from: new Date(to.getTime() - TRAIL_MINUTES * 60000).toISOString(),
        to: to.toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query}`, { signal });
      setHistory(await response.json());
    },
    [enabled, selectedId],
  );

  // Live positions join the trail; old points fall off every minute.
  useEffect(() => {
    if (enabled && live) setHistory((current) => [...current, live]);
  }, [enabled, live]);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, [enabled]);

  const features = useMemo(() => {
    void tick;
    const points = enabled ? trailPoints(history) : [];
    return points.length > 1
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: points.map((point) => toMapCoordinates(point.longitude, point.latitude)),
            },
            properties: {},
          },
        ]
      : [];
  }, [enabled, history, tick]);

  useMapLayer({
    layers: [
      casingLayer(theme),
      {
        type: 'line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': theme.palette.geometry.main,
          'line-width': 3,
          'line-opacity': 0.8,
        },
      },
    ],
    layersDeps: [theme.palette.mode],
    data: { type: 'FeatureCollection', features },
    dataDeps: [features],
  });

  return null;
};

export default MapSelectedTrail;

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch } from 'react-redux';
import MapView, { map } from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapPadding from '../map/MapPadding';
import { devicesActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import MapPositionMarkers from '../map/MapPositionMarkers';
import MapOverlay from '../map/overlay/MapOverlay';
import MapGeocoder from '../map/control/MapGeocoder';
import MapScale from '../map/MapScale';
import MapRuler from '../map/control/MapRuler';
import MapFitFleet from '../map/control/MapFitFleet';
import MapFocusedEvent from '../map/main/MapFocusedEvent';
import MapContextMenu from '../map/main/MapContextMenu';
import GeofenceInside from '../map/main/GeofenceInside';
import MapAreaSelect from '../map/main/MapAreaSelect';
import MapSelectedTrail from '../map/main/MapSelectedTrail';
import MapHoverCard from './MapHoverCard';
import useFeatures from '../common/util/useFeatures';
import { useStableArray } from '../common/util/stableArray';
import RewindToggle, { useToggleStyles } from './RewindToggle';
import MapHeatmap from '../map/MapHeatmap';
import { IconButton, Tooltip } from '@mui/material';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import { useTranslation } from '../common/components/LocalizationProvider';

const HeatLayerPanel = lazy(() => import('./HeatLayerPanel'));

const MainMap = ({ filteredPositions, selectedPosition }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const features = useFeatures();

  const [rulerActive, setRulerActive] = useState(false);
  // LIV-12: the vehicle under the mouse, for the hover card.
  const [hover, setHover] = useState(null);
  const onMarkerHover = useCallback(
    (properties, point) =>
      setHover(properties ? { deviceId: properties.deviceId, ...point } : null),
    [],
  );
  // LIV-26: the fleet at a past moment, or null for live.
  const [rewound, setRewound] = useState(null);
  const [geofenceTarget, setGeofenceTarget] = useState(null);
  // LIV-27: the heat layer: open or not, and its points once loaded.
  const t = useTranslation();
  const { classes: toggle } = useToggleStyles();
  const [heatOpen, setHeatOpen] = useState(false);
  const [heatPoints, setHeatPoints] = useState(null);

  const deviceIds = useStableArray(
    useMemo(() => filteredPositions.map((position) => position.deviceId), [filteredPositions]),
  );

  const onMarkerClick = useCallback(
    (_, deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
    },
    [dispatch],
  );

  // A click on an empty part of the map (not a marker, cluster or the ruler) clears the
  // selection. It waits for a possible second click: a double click zooms and keeps it.
  const clickTimerRef = useRef(null);
  const onMapClick = useCallback(() => {
    if (rulerActive) {
      return;
    }
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => dispatch(devicesActions.selectId(null)), 300);
  }, [dispatch, rulerActive]);

  // The hover card stays where the marker was; it goes when the map moves.
  useEffect(() => {
    const hide = () => setHover(null);
    map.on('movestart', hide);
    return () => map.off('movestart', hide);
  }, []);

  useEffect(() => {
    const onDoubleClick = () => clearTimeout(clickTimerRef.current);
    map.on('dblclick', onDoubleClick);
    return () => {
      map.off('dblclick', onDoubleClick);
      clearTimeout(clickTimerRef.current);
    };
  }, []);

  return (
    <>
      <MapView>
        <MapOverlay />
        <MapGeofence onGeofenceClick={setGeofenceTarget} />
        {heatOpen && heatPoints?.length > 0 && <MapHeatmap points={heatPoints} underLabels />}
        {/* LIV-12: the accuracy circle only for the selected vehicle. */}
        <MapAccuracy positions={selectedPosition ? [selectedPosition] : []} />
        {!rewound && <MapLiveRoutes deviceIds={deviceIds} />}
        {!rewound && <MapSelectedTrail />}
        <PoiMap />
        <MapPositionMarkers
          positions={rewound || filteredPositions}
          onMarkerClick={onMarkerClick}
          onMapClick={onMapClick}
          onMarkerHover={desktop ? onMarkerHover : undefined}
          selectedPosition={selectedPosition}
          showStatus
          smooth
          selectionRing
          disabled={rulerActive}
        />
        <MapDefaultCamera filteredPositions={filteredPositions} />
        <MapSelectedDevice />
        <MapFocusedEvent />
        <MapRuler positions={filteredPositions} onActiveChange={setRulerActive} />
        <MapFitFleet positions={rewound || filteredPositions} />
        <MapAreaSelect positions={rewound || filteredPositions} />
      </MapView>
      <MapScale />
      <MapCurrentLocation />
      <MapGeocoder />
      <MapContextMenu />
      <GeofenceInside target={geofenceTarget} onClose={() => setGeofenceTarget(null)} />
      <MapHoverCard hover={hover} />
      {heatOpen && (
        <Suspense fallback={null}>
          <HeatLayerPanel
            deviceIds={deviceIds}
            onPoints={setHeatPoints}
            startPadding={
              desktop && !features.disableDeviceList
                ? theme.dimensions.devicePanelWidth + 2 * theme.dimensions.panelGap
                : 0
            }
            onClose={() => {
              setHeatOpen(false);
              setHeatPoints(null);
            }}
          />
        </Suspense>
      )}
      <RewindToggle
        deviceIds={deviceIds}
        onRewind={(positions) => setRewound(positions)}
        extra={
          <Tooltip title={t('heatLayerTitle')}>
            <IconButton
              className={toggle.toggle}
              aria-label={t('heatLayerTitle')}
              aria-pressed={heatOpen}
              color={heatOpen ? 'primary' : 'default'}
              onClick={() => {
                setHeatOpen((open) => !open);
                setHeatPoints(null);
              }}
            >
              <WhatshotRoundedIcon />
            </IconButton>
          </Tooltip>
        }
        startPadding={
          desktop && !features.disableDeviceList
            ? theme.dimensions.devicePanelWidth + 2 * theme.dimensions.panelGap
            : 0
        }
      />
      {desktop && !features.disableDeviceList && (
        <MapPadding start={theme.dimensions.devicePanelWidth + 2 * theme.dimensions.panelGap} />
      )}
    </>
  );
};

export default MainMap;

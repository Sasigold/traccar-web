import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import useFeatures from '../common/util/useFeatures';
import { useStableArray } from '../common/util/stableArray';
import RewindToggle from './RewindToggle';

const MainMap = ({ filteredPositions, selectedPosition }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const features = useFeatures();

  const [rulerActive, setRulerActive] = useState(false);
  // LIV-26: the fleet at a past moment, or null for live.
  const [rewound, setRewound] = useState(null);
  const [geofenceTarget, setGeofenceTarget] = useState(null);

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
        {/* LIV-12: the accuracy circle only for the selected vehicle. */}
        <MapAccuracy positions={selectedPosition ? [selectedPosition] : []} />
        {!rewound && <MapLiveRoutes deviceIds={deviceIds} />}
        <PoiMap />
        <MapPositionMarkers
          positions={rewound || filteredPositions}
          onMarkerClick={onMarkerClick}
          onMapClick={onMapClick}
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
      <RewindToggle
        deviceIds={deviceIds}
        onRewind={(positions) => setRewound(positions)}
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

import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useLivePositions } from '../../../common/fleet/usePrivacy';
import MapView from '../../../map/core/MapView';
import MapPositionMarkers from '../../../map/MapPositionMarkers';
import MapDefaultCamera from '../../../map/main/MapDefaultCamera';
import { devicesActions } from '../../../store';
import { useDashboardData } from '../../data/DashboardDataContext';

// The live fleet map, scoped to the filter. The app has a single map instance, so the
// dashboard allows one map widget; a marker opens the vehicle on the main map.
const LiveMapWidget = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { deviceIds } = useDashboardData();
  const positions = useLivePositions();
  const scoped = useMemo(
    () => deviceIds.map((id) => positions[id]).filter(Boolean),
    [deviceIds, positions],
  );
  const onMarkerClick = useCallback(
    (_, deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
      navigate('/');
    },
    [dispatch, navigate],
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MapView>
        <MapPositionMarkers positions={scoped} onMarkerClick={onMarkerClick} showStatus smooth />
        <MapDefaultCamera filteredPositions={scoped} />
      </MapView>
    </div>
  );
};

export default LiveMapWidget;

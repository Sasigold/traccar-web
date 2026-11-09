import { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import MapMarkers from './MapMarkers';
import { formatTime, getStatusColor } from '../common/util/formatter';
import { deviceIconKey, isDeviceMoving, isHeadingIcon } from './core/preloadImages';
import { useAttributePreference } from '../common/util/preferences';
import { fromMapCoordinates } from './core/mapUtil';

const SMOOTH_LIMIT = 300;

const MapPositionMarkers = ({
  positions,
  onMapClick,
  onMarkerClick,
  showStatus,
  selectedPosition,
  titleField,
  disabled,
  smooth,
  selectionRing,
}) => {
  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const mapCluster = useAttributePreference('mapCluster', true);
  const directionType = useAttributePreference('mapDirection', 'selected');

  const selectTime = useSelector((state) => state.devices.selectTime);

  const onMapClickCallback = useCallback(
    (event) => {
      if (!event.defaultPrevented && onMapClick) {
        const [longitude, latitude] = fromMapCoordinates(event.lngLat.lng, event.lngLat.lat);
        onMapClick(latitude, longitude);
      }
    },
    [onMapClick],
  );

  useEffect(() => {
    map.on('click', onMapClickCallback);
    return () => map.off('click', onMapClickCallback);
  }, [onMapClickCallback]);

  // Built once per new fix (not per animation frame): MapMarkers glides between them.
  const markers = useMemo(() => {
    const buildMarker = (position) => {
      const device = devices[position.deviceId];
      let showDirection;
      switch (directionType) {
        case 'none':
          showDirection = false;
          break;
        case 'all':
          showDirection = position.course > 0;
          break;
        default:
          showDirection = selectedPosition?.id === position.id && position.course > 0;
          break;
      }
      const color = showStatus
        ? position.attributes.color || getStatusColor(device.status)
        : 'neutral';
      const title =
        titleField === 'fixTime' ? formatTime(position.fixTime, 'seconds') : device.name;
      const iconKey = deviceIconKey(
        device.category,
        showStatus && isDeviceMoving(device, position),
      );
      // A top-down vehicle already shows where it is heading; it needs no direction arrow.
      const heading = isHeadingIcon(iconKey);
      return {
        id: position.id,
        deviceId: position.deviceId,
        latitude: position.latitude,
        longitude: position.longitude,
        image: `${iconKey}-${color}`,
        title,
        fixTime: position.fixTime,
        rotation: position.course,
        direction: showDirection && !heading,
        heading,
      };
    };

    return positions.filter((it) => devices.hasOwnProperty(it.deviceId)).map(buildMarker);
  }, [positions, devices, directionType, showStatus, selectedPosition, titleField]);

  const otherMarkers = useMemo(
    () => markers.filter((it) => it.deviceId !== selectedDeviceId),
    [markers, selectedDeviceId],
  );
  const selectedMarkers = useMemo(
    () => markers.filter((it) => it.deviceId === selectedDeviceId),
    [markers, selectedDeviceId],
  );
  // Gliding every marker costs a map update per frame; above this many it is switched off.
  const glide = Boolean(smooth) && markers.length <= SMOOTH_LIMIT;

  const onClick = useCallback(
    (properties) => onMarkerClick?.(properties.id, properties.deviceId),
    [onMarkerClick],
  );

  return (
    <>
      <MapMarkers
        markers={otherMarkers}
        showTitles
        direction
        cluster={mapCluster}
        onClick={onClick}
        disabled={disabled}
        smooth={glide}
      />
      <MapMarkers
        markers={selectedMarkers}
        showTitles
        direction
        onClick={onClick}
        disabled={disabled}
        smooth={glide}
        ring={Boolean(selectionRing)}
        ringPulse={selectTime}
      />
    </>
  );
};

export default MapPositionMarkers;

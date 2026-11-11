import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import MapMarkers from './MapMarkers';
import { formatTime, getStatusColor } from '../common/util/formatter';
import { deviceIconKey, isDeviceMoving, isHeadingIcon } from './core/preloadImages';
import { useAttributePreference } from '../common/util/preferences';
import { fromMapCoordinates } from './core/mapUtil';
import { useStableArray } from '../common/util/stableArray';
import { setMovingAnimation } from './core/movingIcon';

const SMOOTH_LIMIT = 300;

const MapPositionMarkers = ({
  positions,
  onMapClick,
  onMarkerClick,
  onMarkerHover,
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

  // Built once per new fix (not per animation frame): MapMarkers glides between them. A marker
  // whose position and vehicle did not change is reused, so when only the selected vehicle
  // reports (once a second, ahead of the throttle) the rest of the fleet's source is untouched.
  const cacheRef = useRef(new WeakMap());
  const markers = useMemo(() => {
    const cache = cacheRef.current;
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
        // LIV-29: counted by the clusters (their ring shows the state of most of their vehicles).
        status: device.status || 'unknown',
        // LIV-29: a vehicle whose latest position carries an alarm marks its cluster.
        alert: position.attributes?.alarm ? 1 : 0,
        title,
        fixTime: position.fixTime,
        rotation: position.course,
        direction: showDirection && !heading,
        heading,
      };
    };

    const flags = `${directionType}|${showStatus}|${titleField}`;
    const cachedMarker = (position) => {
      const device = devices[position.deviceId];
      const directed = selectedPosition?.id === position.id;
      const entry = cache.get(position);
      if (
        entry &&
        entry.device === device &&
        entry.directed === directed &&
        entry.flags === flags
      ) {
        return entry.marker;
      }
      const marker = buildMarker(position);
      cache.set(position, { device, directed, flags, marker });
      return marker;
    };

    return positions.filter((it) => devices.hasOwnProperty(it.deviceId)).map(cachedMarker);
  }, [positions, devices, selectedPosition, directionType, showStatus, titleField]);

  const otherMarkers = useStableArray(
    useMemo(
      () => markers.filter((it) => it.deviceId !== selectedDeviceId),
      [markers, selectedDeviceId],
    ),
  );
  const selectedMarkers = useStableArray(
    useMemo(
      () => markers.filter((it) => it.deviceId === selectedDeviceId),
      [markers, selectedDeviceId],
    ),
  );
  // Gliding every marker costs a map update per frame; above this many it is switched off, and
  // so is the animation of the driving icon (a repaint of the whole map 15 times a second).
  const glide = Boolean(smooth) && markers.length <= SMOOTH_LIMIT;
  const fewMarkers = markers.length <= SMOOTH_LIMIT;
  useEffect(() => {
    setMovingAnimation(fewMarkers);
  }, [fewMarkers]);
  useEffect(() => () => setMovingAnimation(true), []);

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
        onHover={onMarkerHover}
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

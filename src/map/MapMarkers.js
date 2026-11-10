// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { map } from './core/MapView';
import useMapLayer from './core/useMapLayer';
import { useAttributePreference } from '../common/util/preferences';
import { useCatchCallback } from '../reactHelper';
import { findFonts, toMapCoordinates } from './core/mapUtil';
import { createTrack, retargetTrack, trackCoordinates } from './core/motion';
import { prefersReducedMotion } from './core/movingIcon';

// Marker images are 48 px squares; the selection ring sits just outside the disc.
const MARKER_SIZE = 48;
const RING_PULSE_MS = 700;

const toFeature = (marker, coordinates) => {
  const {
    latitude,
    longitude,
    image,
    title,
    rotation,
    direction: showDirection,
    heading,
    ...rest
  } = marker;
  const shown = coordinates || { latitude, longitude, course: rotation };
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: toMapCoordinates(shown.longitude, shown.latitude),
    },
    properties: {
      ...rest,
      image: image || 'default-neutral',
      title: title || '',
      rotation: (coordinates ? shown.course : rotation) || 0,
      direction: showDirection || false,
      heading: heading || false,
    },
  };
};

const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
const onMouseLeave = () => (map.getCanvas().style.cursor = '');

// Vehicle markers. With `smooth`, markers glide from one fix to the next: the glide runs in an
// animation-frame loop that only updates this map source; React renders once per new fix, not
// per frame. With `ring`, an aqua ring is drawn around every marker of this source (used for the
// selected vehicle) and pulses once each time `ringPulse` changes.
const MapMarkers = ({
  markers,
  showTitles,
  cluster,
  direction,
  onClick,
  disabled,
  smooth = false,
  ring = false,
  ringPulse,
}) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.75 : 1);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onMarkerClick = useCallback(
    (event) => {
      if (disabledRef.current) return;
      event.preventDefault();
      onClick?.(event.features[0].properties);
    },
    [onClick],
  );

  const onClusterClick = useCatchCallback(async (event) => {
    if (disabledRef.current) return;
    event.preventDefault();
    const feature = event.features[0];
    const zoom = await map
      .getSource(feature.source)
      .getClusterExpansionZoom(feature.properties.cluster_id);
    map.easeTo({ center: feature.geometry.coordinates, zoom });
  }, []);

  const iconLayout = showTitles
    ? {
        'icon-image': '{image}',
        'icon-size': iconScale,
        'icon-allow-overlap': true,
        'text-field': '{title}',
        // LIV-12: names do not cover each other; a name that would is left out, the icon stays.
        'text-allow-overlap': false,
        'text-optional': true,
        'text-anchor': 'bottom',
        'text-offset': [0, -2 * iconScale],
        'text-font': findFonts(map),
        'text-size': 12,
        'symbol-sort-key': ['get', 'id'],
      }
    : {
        'icon-image': '{image}',
        'icon-size': iconScale,
        'icon-allow-overlap': true,
        'symbol-sort-key': ['get', 'id'],
      };
  const iconLayer = {
    type: 'symbol',
    ...(showTitles
      ? {
          // Names read on the light and the night basemap alike.
          paint:
            theme.palette.mode === 'dark'
              ? {
                  'text-color': theme.palette.brand.white,
                  'text-halo-color': theme.palette.brand.ink,
                  'text-halo-width': 1.2,
                }
              : {
                  'text-color': theme.palette.brand.ink,
                  'text-halo-color': theme.palette.brand.white,
                  'text-halo-width': 1.2,
                },
        }
      : {}),
    ...(onClick
      ? { on: { mouseenter: onMouseEnter, mouseleave: onMouseLeave, click: onMarkerClick } }
      : {}),
  };

  const ringRadius = (MARKER_SIZE / 2) * iconScale + 1;
  const layers = [
    ...(ring
      ? [
          {
            key: 'ring',
            type: 'circle',
            filter: ['!has', 'point_count'],
            paint: {
              'circle-radius': ringRadius,
              'circle-opacity': 0,
              'circle-stroke-color': theme.palette.brand.aqua,
              'circle-stroke-width': 3,
              'circle-pitch-alignment': 'map',
            },
          },
        ]
      : []),
    {
      ...iconLayer,
      filter: ['all', ['!has', 'point_count'], ['!=', 'heading', true]],
      layout: iconLayout,
    },
    {
      // Top-down vehicles: the image points north and turns with the course on the map.
      ...iconLayer,
      key: 'heading',
      filter: ['all', ['!has', 'point_count'], ['==', 'heading', true]],
      layout: {
        ...iconLayout,
        'icon-rotate': ['get', 'rotation'],
        'icon-rotation-alignment': 'map',
      },
    },
  ];

  if (direction) {
    layers.push({
      key: 'direction',
      type: 'symbol',
      filter: ['all', ['!has', 'point_count'], ['==', 'direction', true]],
      layout: {
        'icon-image': 'direction',
        'icon-size': iconScale,
        'icon-allow-overlap': true,
        'icon-rotate': ['get', 'rotation'],
        'icon-rotation-alignment': 'map',
      },
    });
  }

  if (cluster) {
    // LIV-29: a ring under the count, in the color of most of the cluster's vehicles: aqua
    // online, red offline, slate unknown or mixed.
    const half = ['/', ['get', 'point_count'], 2];
    layers.push({
      key: 'clusterRing',
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ringRadius + 1,
        'circle-opacity': 0,
        'circle-stroke-width': 3,
        'circle-stroke-color': [
          'case',
          ['>', ['get', 'offline'], half],
          theme.palette.error.main,
          ['>', ['get', 'online'], half],
          theme.palette.brand.aqua,
          theme.palette.brand.slate,
        ],
      },
    });
    layers.push({
      key: 'clusters',
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': 'background',
        'icon-size': iconScale,
        'icon-allow-overlap': true,
        'text-field': '{point_count_abbreviated}',
        'text-font': findFonts(map),
        'text-size': 14,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': theme.palette.brand.paper,
      },
      on: { mouseenter: onMouseEnter, mouseleave: onMouseLeave, click: onClusterClick },
    });
  }

  // Glide state, kept outside React: one track per device (see motion.js).
  const tracksRef = useRef(new Map());
  const animate = smooth && !prefersReducedMotion();

  const id = useMapLayer({
    source: cluster
      ? {
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          clusterProperties: {
            online: ['+', ['case', ['==', ['get', 'status'], 'online'], 1, 0]],
            offline: ['+', ['case', ['==', ['get', 'status'], 'offline'], 1, 0]],
          },
        }
      : undefined,
    layers,
    layersDeps: [
      theme.palette.mode,
      showTitles,
      cluster,
      direction,
      iconScale,
      onMarkerClick,
      onClusterClick,
      ring,
      ringRadius,
    ],
  });

  // New fixes: retarget the tracks from wherever each marker is shown now (nothing jumps), put
  // the data on the map, and run the glide loop while any marker is between fixes. Also runs
  // when the layers were rebuilt, since that empties the source.
  useEffect(() => {
    const tracks = tracksRef.current;
    const trackKey = (marker) => marker.deviceId ?? marker.id;
    const now = performance.now();
    const seen = new Set();
    markers.forEach((marker) => {
      const key = trackKey(marker);
      seen.add(key);
      const target = {
        latitude: marker.latitude,
        longitude: marker.longitude,
        course: marker.rotation || 0,
        fixTime: marker.fixTime,
      };
      const track = tracks.get(key);
      if (!track) {
        tracks.set(key, createTrack(target));
      } else if (
        track.target.latitude !== target.latitude ||
        track.target.longitude !== target.longitude ||
        track.target.course !== target.course
      ) {
        retargetTrack(track, target, now, animate);
      }
    });
    tracks.forEach((_, key) => {
      if (!seen.has(key)) {
        tracks.delete(key);
      }
    });

    const update = (time) => {
      map.getSource(id)?.setData({
        type: 'FeatureCollection',
        features: markers.map((marker) => {
          const track = tracks.get(trackKey(marker));
          return toFeature(marker, track ? trackCoordinates(track, time) : null);
        }),
      });
    };
    const gliding = () => [...tracks.values()].some((track) => track.start != null);

    update(now);
    let frame = null;
    const step = (time) => {
      frame = null;
      if (!map.getSource(id)) {
        return;
      }
      update(time);
      if (gliding()) {
        frame = requestAnimationFrame(step);
      }
    };
    if (animate && gliding()) {
      frame = requestAnimationFrame(step);
    }
    return () => {
      if (frame != null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    id,
    markers,
    animate,
    showTitles,
    cluster,
    direction,
    iconScale,
    onMarkerClick,
    onClusterClick,
    ring,
    ringRadius,
  ]);

  // One pulse of the ring: it starts wide and faint and closes in on the marker.
  useEffect(() => {
    const layerId = `${id}-ring`;
    if (!ring || !ringPulse || prefersReducedMotion() || !map.getLayer(layerId)) {
      return undefined;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      if (!map.getLayer(layerId)) {
        return;
      }
      // LIV-30: the first frame's timestamp can be earlier than `start`; a negative progress
      // made the stroke opacity negative (an invalid paint value).
      const progress = Math.max(0, Math.min((now - start) / RING_PULSE_MS, 1));
      const eased = 1 - (1 - progress) ** 3;
      map.setPaintProperty(layerId, 'circle-radius', ringRadius + 14 * (1 - eased));
      map.setPaintProperty(layerId, 'circle-stroke-opacity', 0.35 + 0.65 * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'circle-radius', ringRadius);
        map.setPaintProperty(layerId, 'circle-stroke-opacity', 1);
      }
    };
  }, [id, ring, ringPulse, ringRadius]);

  return null;
};

export default MapMarkers;

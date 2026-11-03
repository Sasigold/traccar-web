import 'maplibre-gl/dist/maplibre-gl.css';
import './mapControls.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { googleProtocol } from 'maplibre-google-maps';
import { Protocol } from 'pmtiles';
import { useRef, useLayoutEffect, useEffect, useState, useMemo } from 'react';
import { useTheme, alpha } from '@mui/material';
import MapSwitcher from '../control/MapSwitcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState from '../../common/util/usePersistedState';
import { mapImages } from './preloadImages';
import useMapStyles from './useMapStyles';
import { useAsyncTask } from '../../reactHelper';

const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';
element.style.boxSizing = 'initial';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
maplibregl.addProtocol('google', googleProtocol);
maplibregl.addProtocol('pmtiles', new Protocol().tile);

export const map = new maplibregl.Map({
  container: element,
  attributionControl: false,
});

let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

export const useMapReady = () => {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const listener = (value) => setMapReady(value);
    addReadyListener(listener);
    return () => {
      removeReadyListener(listener);
    };
  }, []);

  return mapReady;
};

const initMap = async () => {
  if (ready) return;
  if (!map.hasImage('background')) {
    Object.entries(mapImages).forEach(([key, value]) => {
      map.addImage(key, value, {
        pixelRatio: window.devicePixelRatio,
      });
    });
  }
};

const MapView = ({ children }) => {
  const theme = useTheme();

  const containerRef = useRef(null);

  const mapReady = useMapReady();

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference(
    'activeMapStyles',
    'openFreeMap,locationIqStreets,locationIqDark',
  );
  const [selectedStyleId, setSelectedStyleId] = usePersistedState(
    'selectedMapStyle',
    usePreference('map', 'openFreeMap'),
  );
  const maxZoom = useAttributePreference('web.maxZoom');

  const styles = useMemo(() => {
    const filtered = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
    return filtered.length ? filtered : mapStyles.filter((s) => s.id === 'osm');
  }, [mapStyles, activeMapStyles]);

  useAsyncTask(async () => {
    if (theme.direction === 'rtl') {
      maplibregl.setRTLTextPlugin(new URL('mapbox-gl-rtl-text.js', document.baseURI).href);
    }
  }, [theme.direction]);

  useEffect(() => {
    const attribution = new maplibregl.AttributionControl({ compact: true });
    const navigation = new maplibregl.NavigationControl();
    map.addControl(attribution, theme.direction === 'rtl' ? 'bottom-left' : 'bottom-right');
    map.addControl(navigation, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => {
      map.removeControl(navigation);
      map.removeControl(attribution);
    };
  }, [theme.direction]);

  useEffect(() => {
    if (maxZoom) {
      map.setMaxZoom(maxZoom);
    }
  }, [maxZoom]);

  useEffect(() => {
    const style = styles.find((s) => s.id === selectedStyleId);
    if (!style) {
      setSelectedStyleId(styles[0].id);
      return;
    }
    updateReadyValue(false);
    map.coordinateSystem = style.coordinateSystem;
    map.setStyle(style.style, { diff: false });
    map.setTransformRequest(style.transformRequest);
    let timeoutId;
    const waiting = () => {
      if (!map.loaded()) {
        timeoutId = setTimeout(waiting, 33);
      } else {
        initMap();
        updateReadyValue(true);
      }
    };
    map.once('styledata', waiting);
    return () => clearTimeout(timeoutId);
  }, [styles, selectedStyleId, setSelectedStyleId]);

  useLayoutEffect(() => {
    const currentEl = containerRef.current;
    currentEl.appendChild(element);
    map.resize();
    return () => {
      currentEl.removeChild(element);
    };
  }, [containerRef]);

  const controlVariables = useMemo(() => {
    const dark = theme.palette.mode === 'dark';
    return {
      '--map-ctrl-bg': alpha(theme.palette.background.paper, 0.82),
      '--map-ctrl-border': dark ? alpha('#ffffff', 0.08) : alpha('#ffffff', 0.7),
      '--map-ctrl-divider': theme.palette.divider,
      '--map-ctrl-hover': alpha(theme.palette.primary.main, 0.1),
      '--map-ctrl-fg': theme.palette.text.primary,
      '--map-ctrl-accent': theme.palette.primary.main,
      '--map-ctrl-icon-filter': dark ? 'invert(1) brightness(1.1)' : 'none',
      '--map-ctrl-shadow': dark
        ? `0 14px 36px ${alpha('#000000', 0.5)}`
        : `0 14px 36px ${alpha('#0f172a', 0.14)}`,
    };
  }, [theme]);

  return (
    <div style={{ width: '100%', height: '100%', ...controlVariables }} ref={containerRef}>
      <MapSwitcher styles={styles} selectedId={selectedStyleId} onSelect={setSelectedStyleId} />
      {mapReady && children}
    </div>
  );
};

export default MapView;

import 'maplibre-gl/dist/maplibre-gl.css';
import './mapControls.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { useRef, useLayoutEffect, useEffect, useState, useMemo } from 'react';
import { useTheme, alpha } from '@mui/material';
import MapSwitcher from '../control/MapSwitcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState from '../../common/util/usePersistedState';
import preloadImages, { mapImages } from './preloadImages';
import { setCoordinateSystem } from './mapState';
import useMapStyles from './useMapStyles';
import { localizeStyle } from './mapLanguage';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { googleProtocol } from './googleProtocol';
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

// MapLibre reads control labels (tooltips, aria-labels, scale units) from map._locale when a
// control is added, so the app language is applied before any control is created.
const mapLocale = (t) => ({
  'NavigationControl.ZoomIn': t('mapCtrlZoomIn'),
  'NavigationControl.ZoomOut': t('mapCtrlZoomOut'),
  'NavigationControl.ResetBearing': t('mapCtrlResetBearing'),
  'GeolocateControl.FindMyLocation': t('mapCtrlFindMyLocation'),
  'GeolocateControl.LocationNotAvailable': t('mapCtrlLocationNotAvailable'),
  'Map.Title': t('mapCtrlMap'),
  'AttributionControl.ToggleAttribution': t('mapCtrlAttribution'),
  'Popup.Close': t('mapCtrlClose'),
  'FullscreenControl.Enter': t('mapCtrlEnterFullscreen'),
  'FullscreenControl.Exit': t('mapCtrlExitFullscreen'),
  'ScaleControl.Meters': t('mapCtrlMeters'),
  'ScaleControl.Kilometers': t('mapCtrlKilometers'),
  'ScaleControl.Miles': t('mapCtrlMiles'),
  'ScaleControl.Feet': t('mapCtrlFeet'),
  'ScaleControl.NauticalMiles': t('mapCtrlNauticalMiles'),
});

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
  const { language } = useLocalization();
  const t = useTranslation();

  // Layout effect: runs before the control effects below (and before child controls mount).
  useLayoutEffect(() => {
    map._locale = { ...map._locale, ...mapLocale(t) };
    map.getCanvas().setAttribute('aria-label', t('mapCtrlMap'));
  }, [t]);

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
    setCoordinateSystem(style.coordinateSystem);
    map.setStyle(style.style, {
      diff: false,
      transformStyle: (_, nextStyle) => localizeStyle(nextStyle, language),
    });
    map.setTransformRequest(style.transformRequest);
    let timeoutId;
    const waiting = () => {
      if (!map.loaded()) {
        timeoutId = setTimeout(waiting, 33);
      } else {
        // Marker images are prepared on first use of a map (not on every page).
        preloadImages().then(() => {
          initMap();
          updateReadyValue(true);
        });
      }
    };
    map.once('styledata', waiting);
    return () => clearTimeout(timeoutId);
  }, [styles, selectedStyleId, setSelectedStyleId, language]);

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
      '--map-ctrl-bg': alpha(theme.palette.background.paper, 0.88),
      '--map-ctrl-border': theme.palette.surface.border,
      '--map-ctrl-divider': theme.palette.surface.border,
      '--map-ctrl-hover': alpha(theme.palette.primary.main, 0.1),
      '--map-ctrl-fg': theme.palette.text.primary,
      '--map-ctrl-accent': theme.palette.primary.main,
      '--map-ctrl-icon-filter': dark ? 'invert(1) brightness(1.1)' : 'none',
      '--map-ctrl-shadow': theme.shadows[3],
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

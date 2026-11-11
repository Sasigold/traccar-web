// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import 'maplibre-gl/dist/maplibre-gl.css';
import './mapControls.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { useRef, useLayoutEffect, useEffect, useState, useMemo } from 'react';
import { useTheme } from '@mui/material';
import MapSwitcher from '../control/MapSwitcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState from '../../common/util/usePersistedState';
import preloadImages, { mapImages } from './preloadImages';
import { getGcoord, loadGcoord, setCoordinateSystem } from './mapState';
import useMapStyles from './useMapStyles';
import { localizeStyle } from './mapLanguage';
import { brandStyle } from './brandStyle';
import mapControlVariables from './controlVariables';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { googleProtocol } from './googleProtocol';
import { useAsyncTask } from '../../reactHelper';
import { MapFailed, MapLoading } from './MapStatus';

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
    'viperFleet,openFreeMap,locationIqStreets,locationIqDark',
  );
  // One choice for light mode and one for dark, both starting on the brand map.
  const dark = theme.palette.mode === 'dark';
  const defaultStyle = usePreference('map', 'viperFleet');
  const [lightStyleId, setLightStyleId] = usePersistedState('mapStyleLight', defaultStyle);
  const [darkStyleId, setDarkStyleId] = usePersistedState('mapStyleDark', defaultStyle);
  const selectedStyleId = dark ? darkStyleId : lightStyleId;
  const setSelectedStyleId = dark ? setDarkStyleId : setLightStyleId;
  const maxZoom = useAttributePreference('web.maxZoom');
  const [gcoordReady, setGcoordReady] = useState(() => Boolean(getGcoord()));
  // LIV-12: while the map style loads, a loader; if it fails, a way to retry or switch layers.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    const onError = (event) => {
      if (!map.isStyleLoaded() && /fetch|style|load/i.test(event?.error?.message || '')) {
        setFailed(true);
      }
    };
    map.on('error', onError);
    const timer = setTimeout(() => !map.isStyleLoaded() && setFailed(true), 20000);
    return () => {
      map.off('error', onError);
      clearTimeout(timer);
    };
  }, [selectedStyleId]);

  const styles = useMemo(() => {
    // The brand map is always offered.
    const filtered = mapStyles.filter(
      (s) => s.available && (s.id === 'viperFleet' || activeMapStyles.includes(s.id)),
    );
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
    // A Chinese map needs gcoord first (loaded on demand); the style is set once it is there.
    if (style.coordinateSystem && !gcoordReady) {
      let cancelled = false;
      loadGcoord().then(() => !cancelled && setGcoordReady(true));
      return () => {
        cancelled = true;
      };
    }
    updateReadyValue(false);
    setCoordinateSystem(style.coordinateSystem);
    map.setStyle(style.style, {
      diff: false,
      transformStyle: (_, nextStyle) => {
        const localized = localizeStyle(nextStyle, language);
        return style.brand ? brandStyle(localized, dark) : localized;
      },
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
  }, [styles, selectedStyleId, setSelectedStyleId, language, dark, gcoordReady]);

  useLayoutEffect(() => {
    const currentEl = containerRef.current;
    currentEl.appendChild(element);
    map.resize();
    return () => {
      currentEl.removeChild(element);
    };
  }, [containerRef]);

  const controlVariables = useMemo(() => mapControlVariables(theme), [theme]);

  return (
    <div style={{ width: '100%', height: '100%', ...controlVariables }} ref={containerRef}>
      <MapSwitcher styles={styles} selectedId={selectedStyleId} onSelect={setSelectedStyleId} />
      {!mapReady && !failed && <MapLoading />}
      {!mapReady && failed && (
        <MapFailed
          // The map instance is shared by every page; a reload starts it cleanly.
          onRetry={() => window.location.reload()}
          onSwitch={() => {
            const next = styles.find((item) => item.id !== selectedStyleId);
            if (next) setSelectedStyleId(next.id);
          }}
          canSwitch={styles.length > 1}
        />
      )}
      {mapReady && children}
    </div>
  );
};

export default MapView;

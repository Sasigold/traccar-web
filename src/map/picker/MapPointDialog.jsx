import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import useMapStyles from '../core/useMapStyles';
import { localizeStyle } from '../core/mapLanguage';
import { brandStyle } from '../core/brandStyle';
import mapControlVariables from '../core/controlVariables';
import '../core/mapControls.css';
import { prefersReducedMotion } from '../core/movingIcon';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { keepOnBackdrop } from '../../common/util/formDialog';

// The same worker as the main map (MapView may not be loaded on this page).
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Tel Aviv, when there is no point yet.
const DEFAULT_CENTER = [34.78, 32.08];
const PIN_SIZE = 40;

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  frame: {
    position: 'relative',
    height: 'min(56vh, 420px)',
    borderRadius: theme.tokens.radius.md,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.surface.border}`,
  },
  // MapLibre makes its container position: relative; it fills the frame by size instead.
  map: {
    width: '100%',
    height: '100%',
  },
  // The pin stands on the map's center: the point is wherever the map is moved to.
  pin: {
    position: 'absolute',
    insetInlineStart: '50%',
    top: '50%',
    width: PIN_SIZE,
    height: PIN_SIZE,
    marginInlineStart: -PIN_SIZE / 2,
    marginTop: -PIN_SIZE,
    color: theme.palette.primary.main,
    filter: `drop-shadow(0 1px 1px ${theme.palette.background.paper})`,
    pointerEvents: 'none',
  },
  coordinates: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
}));

const round = (value) => Math.round(value * 1e6) / 1e6;

// ADM-20: a place picked on a map, for a job or a point of interest. Its own small map (the main
// map is one shared instance), with a pin in the middle: drag the map, click a place, or use the
// arrow keys, then confirm. onPick({ latitude, longitude }).
const MapPointDialog = ({ latitude, longitude, onClose, onPick }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const { language } = useLocalization();
  const mapStyles = useMapStyles();
  const style = mapStyles.find((item) => item.id === 'viperFleet');
  const dark = theme.palette.mode === 'dark';
  // The dialog's portal mounts its content a render later: the map starts once the element is there.
  const [container, setContainer] = useState(null);
  const mapRef = useRef(null);
  const located = Number.isFinite(latitude) && Number.isFinite(longitude);
  const [center, setCenter] = useState(() =>
    located
      ? { latitude, longitude }
      : { latitude: DEFAULT_CENTER[1], longitude: DEFAULT_CENTER[0] },
  );
  const startRef = useRef({ center: [center.longitude, center.latitude], zoom: located ? 15 : 9 });

  useEffect(() => {
    if (!container || !style) return undefined;
    const instance = new maplibregl.Map({
      container,
      attributionControl: { compact: true },
      center: startRef.current.center,
      zoom: startRef.current.zoom,
    });
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      theme.direction === 'rtl' ? 'top-left' : 'top-right',
    );
    instance.setStyle(style.style, {
      transformStyle: (_, next) => brandStyle(localizeStyle(next, language), dark),
    });
    instance.getCanvas().setAttribute('aria-label', t('mapPickTitle'));
    const onMove = () => {
      const { lng, lat } = instance.getCenter();
      setCenter({ latitude: round(lat), longitude: round(lng) });
    };
    const onClick = (event) => {
      const options = { center: event.lngLat };
      if (prefersReducedMotion()) instance.jumpTo(options);
      else instance.easeTo({ ...options, duration: 300 });
    };
    instance.on('move', onMove);
    instance.on('click', onClick);
    mapRef.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      instance.remove();
      mapRef.current = null;
    };
  }, [container, style, language, dark, theme.direction, t]);

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="md">
      <DialogTitle>{t('mapPickTitle')}</DialogTitle>
      <DialogContent className={classes.content}>
        <Typography variant="body2" color="textSecondary">
          {t('mapPickHint')}
        </Typography>
        <div className={classes.frame} style={mapControlVariables(theme)}>
          <div ref={setContainer} className={classes.map} data-testid="map-point-picker" />
          <PlaceRoundedIcon className={classes.pin} aria-hidden />
        </div>
        <Typography variant="caption" className={classes.coordinates} dir="ltr">
          {`${center.latitude.toFixed(6)}, ${center.longitude.toFixed(6)}`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={() => onPick(center)}>
          {t('mapPickConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MapPointDialog;

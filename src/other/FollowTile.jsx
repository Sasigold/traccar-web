import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Chip, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import useMapStyles from '../map/core/useMapStyles';
import { localizeStyle } from '../map/core/mapLanguage';
import { brandStyle } from '../map/core/brandStyle';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { formatSpeed, formatTime } from '../common/util/formatter';
import { useAttributePreference } from '../common/util/preferences';
import { statusColor } from '../common/theme/surfaces';

// The same worker as the main map (MapView may not be loaded on this page).
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const useStyles = makeStyles()((theme) => ({
  tile: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.surface.border}`,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
  map: {
    flex: 1,
    minHeight: 160,
    position: 'relative',
  },
}));

// The marker: a dot in the vehicle's status color with a ring in the paper color.
const markerElement = (color, ring, shadow) => {
  const element = document.createElement('div');
  element.style.width = '18px';
  element.style.height = '18px';
  element.style.borderRadius = '50%';
  element.style.background = color;
  element.style.border = `3px solid ${ring}`;
  element.style.boxShadow = shadow;
  return element;
};

// LIV-28: one vehicle on its own small map that follows it, with its name, status and speed.
// Its own map instance (the main map is a single shared one), on the brand style.
const FollowTile = ({ deviceId }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const { language } = useLocalization();
  const speedUnit = useAttributePreference('speedUnit');
  const device = useSelector((state) => state.devices.items[deviceId]);
  const position = useSelector((state) => state.session.positions[deviceId]);
  const mapStyles = useMapStyles();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const dark = theme.palette.mode === 'dark';
  const style = mapStyles.find((item) => item.id === 'viperFleet');

  useEffect(() => {
    if (!containerRef.current || !style) return undefined;
    const instance = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: { compact: true },
      interactive: true,
      zoom: 14,
      center: [34.78, 32.08],
    });
    instance.setStyle(style.style, {
      transformStyle: (_, next) => brandStyle(localizeStyle(next, language), dark),
    });
    mapRef.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      markerRef.current = null;
      instance.remove();
      mapRef.current = null;
    };
  }, [style, language, dark]);

  const color = statusColor(theme, device?.status);
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !position) return;
    const center = [position.longitude, position.latitude];
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({
        element: markerElement(color, theme.palette.background.paper, theme.shadows[2]),
      })
        .setLngLat(center)
        .addTo(instance);
      instance.jumpTo({ center });
    } else {
      markerRef.current.getElement().style.background = color;
      markerRef.current.setLngLat(center);
      instance.easeTo({ center, duration: 800 });
    }
  }, [position, color, theme.palette.background.paper, theme.shadows]);

  if (!device) return null;

  return (
    <Paper elevation={0} className={classes.tile} component="section" aria-label={device.name}>
      <div className={classes.head}>
        <Typography className={classes.name}>{device.name}</Typography>
        <Chip
          size="small"
          label={t(
            `deviceStatus${device.status === 'online' ? 'Online' : device.status === 'offline' ? 'Offline' : 'Unknown'}`,
          )}
          sx={{ '& .MuiChip-label': { display: 'flex', alignItems: 'center', gap: 0.5 } }}
          icon={
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                marginInlineStart: 8,
              }}
            />
          }
        />
        <Typography variant="caption" className={classes.meta}>
          {position ? formatSpeed(position.speed, speedUnit, t) : '—'}
          {position && ` · ${formatTime(position.fixTime, 'clock')}`}
        </Typography>
      </div>
      <div ref={containerRef} className={classes.map} />
    </Paper>
  );
};

export default FollowTile;

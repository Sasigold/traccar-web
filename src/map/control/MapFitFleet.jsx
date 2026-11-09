import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useDispatch } from 'react-redux';
import { useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ZoomOutMapRoundedIcon from '@mui/icons-material/ZoomOutMapRounded';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';
import { prefersReducedMotion } from '../core/movingIcon';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { shortcutAllowed } from '../../common/util/keyboard';
import { devicesActions } from '../../store';

const useStyles = makeStyles()((theme) => ({
  button: {
    '&&': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.palette.text.primary,
    },
  },
}));

// Fits the map to the vehicles in the list (after filters and search); shortcut 0. Clears the
// selection first, so following one vehicle does not pull the camera back.
const MapFitFleet = ({ positions }) => {
  const theme = useTheme();
  const t = useTranslation();
  const dispatch = useDispatch();
  const { classes } = useStyles();

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  useEffect(() => {
    const fit = () => {
      const coordinates = positionsRef.current.map((item) =>
        toMapCoordinates(item.longitude, item.latitude),
      );
      if (!coordinates.length) {
        return;
      }
      dispatch(devicesActions.selectId(null));
      const duration = prefersReducedMotion() ? 0 : 600;
      if (coordinates.length === 1) {
        map.easeTo({ center: coordinates[0], zoom: Math.max(map.getZoom(), 12), duration });
        return;
      }
      const bounds = coordinates.reduce(
        (result, item) => result.extend(item),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration });
    };

    const label = `${t('mapFitFleet')} (0)`;
    let container;
    let root;
    const control = {
      onAdd: () => {
        container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const button = document.createElement('button');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', t('mapFitFleet'));
        button.setAttribute('aria-keyshortcuts', '0');
        button.className = `maplibregl-ctrl-icon ${classes.button}`;
        button.onclick = fit;
        container.appendChild(button);
        root = createRoot(button);
        root.render(<ZoomOutMapRoundedIcon fontSize="small" />);
        return container;
      },
      onRemove: () => {
        queueMicrotask(() => root.unmount());
        container.remove();
      },
    };
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');

    const onKeyDown = (event) => {
      if (event.key === '0' && shortcutAllowed(event)) {
        fit();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      map.removeControl(control);
    };
  }, [theme.direction, t, dispatch, classes.button]);

  return null;
};

export default MapFitFleet;

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DirectionsRoundedIcon from '@mui/icons-material/DirectionsRounded';
import { map } from '../core/MapView';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useRestriction } from '../../common/util/permissions';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { useFleetFeature } from '../../common/fleet/features';
import { nearbyVehicles } from '../../common/fleet/dispatch';
import { devicesActions, messagesActions } from '../../store';

const LONG_PRESS = 600;

const coordinates = ({ latitude, longitude }) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

// LIV-21: right click (or a long press on touch) on the live map: who is closest, a geofence
// here, the coordinates, and navigation to the point.
const MapContextMenu = () => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const readonly = useRestriction('readonly');
  const dispatchAllowed = useFleetPermission('dispatch.write');
  const dispatchEnabled = useFleetFeature('dispatch');
  const canDispatch = dispatchAllowed && dispatchEnabled;

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const [menu, setMenu] = useState(null);
  const [nearby, setNearby] = useState(null);

  useEffect(() => {
    const open = (event) => {
      const rect = map.getCanvas().getBoundingClientRect();
      setMenu({
        top: rect.top + event.point.y,
        left: rect.left + event.point.x,
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    };
    const onContextMenu = (event) => {
      event.preventDefault();
      open(event);
    };
    let timer;
    const cancel = () => clearTimeout(timer);
    const onTouchStart = (event) => {
      cancel();
      if (event.originalEvent.touches?.length !== 1) return;
      timer = setTimeout(() => open(event), LONG_PRESS);
    };
    map.on('contextmenu', onContextMenu);
    map.on('touchstart', onTouchStart);
    map.on('touchend', cancel);
    map.on('touchmove', cancel);
    map.on('movestart', cancel);
    return () => {
      cancel();
      map.off('contextmenu', onContextMenu);
      map.off('touchstart', onTouchStart);
      map.off('touchend', cancel);
      map.off('touchmove', cancel);
      map.off('movestart', cancel);
    };
  }, []);

  const point = nearby || menu;
  const rows = useMemo(
    () => (nearby ? nearbyVehicles(positions, devices, nearby) : []),
    [nearby, positions, devices],
  );

  const close = () => setMenu(null);
  const query = (extra = {}) =>
    new URLSearchParams({
      latitude: point.latitude.toFixed(6),
      longitude: point.longitude.toFixed(6),
      ...extra,
    }).toString();

  const copy = async () => {
    close();
    try {
      await navigator.clipboard.writeText(coordinates(menu));
      dispatch(messagesActions.push(t('mapCoordinatesCopied')));
    } catch {
      dispatch(messagesActions.push(coordinates(menu)));
    }
  };

  return (
    <>
      <Menu
        open={Boolean(menu)}
        onClose={close}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.top, left: menu.left } : undefined}
      >
        <MenuItem
          onClick={() => {
            setNearby({ latitude: menu.latitude, longitude: menu.longitude });
            close();
          }}
        >
          <ListItemIcon>
            <NearMeRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t('mapNearbyVehicles')}
        </MenuItem>
        {!readonly && (
          <MenuItem
            onClick={() => {
              close();
              navigate(`/settings/geofence?${query()}`);
            }}
          >
            <ListItemIcon>
              <HexagonRoundedIcon fontSize="small" />
            </ListItemIcon>
            {t('mapGeofenceHere')}
          </MenuItem>
        )}
        <MenuItem onClick={copy}>
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t('mapCopyCoordinates')}
        </MenuItem>
        <MenuItem
          component="a"
          href={
            menu ? `https://waze.com/ul?ll=${menu.latitude},${menu.longitude}&navigate=yes` : '#'
          }
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <DirectionsRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t('mapNavigateHere')}
        </MenuItem>
      </Menu>
      <Dialog open={Boolean(nearby)} onClose={() => setNearby(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('mapNearbyVehicles')}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {nearby && (
            <Typography variant="body2" color="textSecondary" sx={{ px: 3, pt: 1.5 }}>
              <span dir="ltr">{coordinates(nearby)}</span>
            </Typography>
          )}
          {rows.length ? (
            <List>
              {rows.map(({ device, km, eta }) => (
                <ListItem
                  key={device.id}
                  disablePadding
                  secondaryAction={
                    canDispatch && (
                      <Button
                        size="small"
                        onClick={() => {
                          setNearby(null);
                          navigate(`/fleet/dispatch?${query({ deviceId: device.id })}`);
                        }}
                      >
                        {t('mapSendJob')}
                      </Button>
                    )
                  }
                >
                  <ListItemButton
                    onClick={() => {
                      dispatch(devicesActions.selectId(device.id));
                      setNearby(null);
                    }}
                  >
                    <ListItemText
                      primary={device.name}
                      secondary={t('mapNearbyDistance')
                        .replace('{0}', km.toFixed(1))
                        .replace('{1}', eta?.minutes ?? 0)}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography sx={{ p: 3 }} color="textSecondary">
              {t('mapNearbyNone')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNearby(null)}>{t('sharedClose')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MapContextMenu;

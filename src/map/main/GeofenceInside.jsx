import { useSelector, useDispatch } from 'react-redux';
import { List, ListItemButton, ListItemText, Popover, Typography } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { devicesActions } from '../../store';
import { capitalize } from '../../common/util/stringUtils';

// LIV-29: the vehicles whose latest position is inside a geofence (Traccar marks it on the
// position). Pure, tested.
export const vehiclesInside = (positions, devices, geofenceId) =>
  Object.values(positions || {})
    .filter((position) => (position.geofenceIds || []).includes(geofenceId))
    .map((position) => devices[position.deviceId])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

// A click inside a geofence on the live map: "Inside: 4 vehicles", each one opening.
const GeofenceInside = ({ target, onClose }) => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const geofence = useSelector((state) => (target ? state.geofences.items[target.id] : null));
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const inside = target ? vehiclesInside(positions, devices, target.id) : [];

  return (
    <Popover
      open={Boolean(target && geofence)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={target ? { top: target.top, left: target.left } : undefined}
      slotProps={{ paper: { 'aria-label': geofence?.name, sx: { minWidth: 220, p: 1 } } }}
    >
      <Typography variant="subtitle2" sx={{ px: 1 }}>
        {geofence?.name}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ px: 1 }}>
        {inside.length
          ? t('geofenceInside').replace('{0}', String(inside.length))
          : t('geofenceInsideNone')}
      </Typography>
      {inside.length > 0 && (
        <List dense>
          {inside.map((device) => (
            <ListItemButton
              key={device.id}
              onClick={() => {
                dispatch(devicesActions.selectId(device.id));
                onClose();
              }}
            >
              <ListItemText
                primary={device.name}
                secondary={t(`deviceStatus${capitalize(device.status || 'unknown')}`)}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Popover>
  );
};

export default GeofenceInside;

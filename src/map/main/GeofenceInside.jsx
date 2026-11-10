import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { List, ListItemButton, ListItemText, Popover, Typography } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { devicesActions } from '../../store';
import { capitalize } from '../../common/util/stringUtils';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { formatNumericHours } from '../../common/util/formatter';

// LIV-29: the vehicles whose latest position is inside a geofence (Traccar marks it on the
// position). Pure, tested.
export const vehiclesInside = (positions, devices, geofenceId) =>
  Object.values(positions || {})
    .filter((position) => (position.geofenceIds || []).includes(geofenceId))
    .map((position) => devices[position.deviceId])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

// LIV-29: how long each vehicle inside has been there: since its latest entry into this geofence
// (events of the last day). Pure, tested. { deviceId: ms }
export const dwellTimes = (events, geofenceId, deviceIds, now = Date.now()) => {
  const result = {};
  events
    .filter((event) => event.type === 'geofenceEnter' && event.geofenceId === geofenceId)
    .forEach((event) => {
      if (!deviceIds.includes(event.deviceId)) return;
      const at = new Date(event.eventTime).getTime();
      if (!(event.deviceId in result) || at > now - result[event.deviceId]) {
        result[event.deviceId] = Math.max(0, now - at);
      }
    });
  return result;
};

export const averageDwell = (dwells) => {
  const values = Object.values(dwells);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

const DAY = 24 * 3600 * 1000;

// A click inside a geofence on the live map: "Inside: 4 vehicles", each one opening.
const GeofenceInside = ({ target, onClose }) => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const geofence = useSelector((state) => (target ? state.geofences.items[target.id] : null));
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const inside = target ? vehiclesInside(positions, devices, target.id) : [];
  const insideKey = inside.map((device) => device.id).join(',');
  const targetId = target?.id;
  const [dwells, setDwells] = useState({});

  useAsyncTask(
    async ({ signal }) => {
      setDwells({});
      if (!targetId || !insideKey) return;
      const ids = insideKey.split(',').map(Number);
      const query = new URLSearchParams({
        from: new Date(Date.now() - DAY).toISOString(),
        to: new Date().toISOString(),
        type: 'geofenceEnter',
      });
      ids.forEach((id) => query.append('deviceId', id));
      const response = await fetchOrThrow(`api/reports/events?${query}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setDwells(dwellTimes(await response.json(), targetId, ids));
    },
    [targetId, insideKey],
  );
  const average = averageDwell(dwells);

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
        {average != null &&
          ` · ${t('geofenceDwellAverage').replace('{0}', formatNumericHours(average, t))}`}
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
                secondary={[
                  t(`deviceStatus${capitalize(device.status || 'unknown')}`),
                  dwells[device.id] != null &&
                    t('geofenceDwell').replace('{0}', formatNumericHours(dwells[device.id], t)),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Popover>
  );
};

export default GeofenceInside;

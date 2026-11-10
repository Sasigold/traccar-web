import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import FormSection from '../../settings/components/FormSection';
import { ensureDriver, ensureVehicle } from '../fleetData';
import { assignDriver, grantMapAccess, vehicleHolder } from '../api/assignments';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import { newDriverConflict } from '../../common/fleet/newDriver';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
}));

// Roadmap 4.1: the driver's assigned vehicle and the system user who is this driver
// (needed for the driver portal). Assigning ends the previous assignment.
const DriverAssignmentSection = ({ driver }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('vehicles.read');
  const canAssign = useFleetPermission('assignments.write');
  const canWriteDrivers = useFleetPermission('drivers.write');
  const canReadUsers = useFleetPermission('users.read');
  const canLink = canWriteDrivers && canReadUsers;
  const devices = useSelector((state) => state.devices.items);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [current, setCurrent] = useState(null);
  const [row, setRow] = useState(null);
  const [users, setUsers] = useState([]);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !driver?.id) {
      return;
    }
    const client = getFleetClient();
    const [assignment, driverRow] = await Promise.all([
      client
        .from('current_assignments')
        .select('*')
        .eq('traccar_driver_id', driver.id)
        .order('starts_at', { ascending: false })
        .limit(1),
      client
        .from('drivers')
        .select('id, profile_id')
        .eq('traccar_driver_id', driver.id)
        .maybeSingle(),
    ]);
    setCurrent((unwrap(assignment) || [])[0] || null);
    setRow(unwrap(driverRow));
    if (canLink) {
      setUsers(
        unwrap(
          await client
            .from('profiles')
            .select('id, full_name, email, traccar_user_id')
            .order('full_name'),
        ) || [],
      );
    }
  }, [canRead, canLink, driver?.id, reloadKey]);

  const options = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  const traccarUserOf = (profileId) => users.find((user) => user.id === profileId)?.traccar_user_id;

  // ADM-17: a vehicle another driver has is passed on only when that is confirmed; the
  // driver's own user then sees it on the map.
  const assign = useCatch(async (deviceId) => {
    const client = getFleetClient();
    const driverId = await ensureDriver(driver, profile);
    let vehicleId = null;
    if (deviceId) {
      const holder = await vehicleHolder(client, Number(deviceId));
      if (
        holder &&
        holder.driver_id !== driverId &&
        !(await confirm({
          title: t('fleetAssignTransferTitle'),
          message: t('fleetAssignTransfer')
            .replace('{0}', devices[deviceId]?.name || '')
            .replace('{1}', holder.driver?.full_name || ''),
          confirmLabel: t('fleetAssignTransferConfirm'),
        }))
      ) {
        return;
      }
      vehicleId = await ensureVehicle(devices[deviceId], profile);
    }
    await assignDriver({ client, profile, driverId, vehicleId });
    if (deviceId) await grantMapAccess(traccarUserOf(row?.profile_id), deviceId);
    reload();
  });

  const link = useCatch(async (profileId) => {
    const driverId = row?.id || (await ensureDriver(driver, profile));
    unwrap(
      await getFleetClient()
        .from('drivers')
        .update({ profile_id: profileId || null })
        .eq('id', driverId),
    );
    if (current?.traccar_device_id) {
      await grantMapAccess(traccarUserOf(profileId), current.traccar_device_id);
    }
    reload();
  });

  if (!canRead || !driver?.id) {
    return null;
  }

  return (
    <FormSection
      title={t('fleetAssignmentTitle')}
      description={t('fleetAssignmentDescription')}
      icon={<DirectionsCarRoundedIcon />}
    >
      <div className={classes.grid}>
        <TextField
          select
          label={t('fleetAssignedVehicle')}
          value={current?.traccar_device_id ? String(current.traccar_device_id) : ''}
          onChange={(event) => assign(event.target.value)}
          disabled={!canAssign}
          helperText={
            current
              ? t('fleetAssignedSince').replace('{0}', formatTime(current.starts_at, 'date'))
              : undefined
          }
        >
          <MenuItem value="">{t('fleetNoVehicle')}</MenuItem>
          {options.map((device) => (
            <MenuItem key={device.id} value={String(device.id)}>
              {device.name}
            </MenuItem>
          ))}
        </TextField>
        {canLink && (
          <TextField
            select
            label={t('fleetLinkedUser')}
            value={row?.profile_id || ''}
            onChange={(event) => link(event.target.value)}
            helperText={t('fleetLinkedUserHint')}
          >
            <MenuItem value="">&nbsp;</MenuItem>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.full_name || user.email}
              </MenuItem>
            ))}
          </TextField>
        )}
      </div>
      {current?.traccar_device_id &&
        newDriverConflict(driver.attributes, devices[current.traccar_device_id]?.attributes) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('newDriverVehicleWarning').replace(
              '{0}',
              devices[current.traccar_device_id]?.name || '',
            )}
          </Alert>
        )}
      {current?.traccar_device_id && row?.profile_id && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {t('fleetAssignSeesOnMap')}
        </Typography>
      )}
      {!current && !canAssign && (
        <Typography variant="body2" color="textSecondary">
          {t('fleetNoVehicle')}
        </Typography>
      )}
    </FormSection>
  );
};

export default DriverAssignmentSection;

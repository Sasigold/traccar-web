import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission } from '../../common/fleet/useFleet';
import FormSection from '../../settings/components/FormSection';
import { ensureDriver, ensureVehicle } from '../fleetData';
import { assignDriver, grantMapAccess, linkedTraccarUser, vehicleHolder } from '../api/assignments';
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

// ADM-14: what the section changed is saved with the driver's form, not on the spot. `pending`
// is { deviceId?, profileId? }; a key that is there was changed ('' clears it).
export const commitDriverAssignment = async (driver, pending, profile, devices) => {
  if (!pending || !Object.keys(pending).length) return;
  const client = getFleetClient();
  const driverId = await ensureDriver(driver, profile);
  if ('profileId' in pending) {
    unwrap(
      await client
        .from('drivers')
        .update({ profile_id: pending.profileId || null })
        .eq('id', driverId),
    );
  }
  if ('deviceId' in pending) {
    const vehicleId = pending.deviceId
      ? await ensureVehicle(devices[pending.deviceId], profile)
      : null;
    await assignDriver({ client, profile, driverId, vehicleId });
  }
  // The driver's own user sees the vehicle they have now on the map.
  const row = unwrap(
    await client.from('drivers').select('profile_id').eq('id', driverId).maybeSingle(),
  );
  const deviceId =
    'deviceId' in pending
      ? Number(pending.deviceId) || null
      : unwrap(
          await client
            .from('current_assignments')
            .select('traccar_device_id')
            .eq('driver_id', driverId),
        )?.[0]?.traccar_device_id;
  if (row?.profile_id && deviceId) {
    await grantMapAccess(await linkedTraccarUser(client, row.profile_id), deviceId);
  }
};

// Roadmap 4.1: the driver's assigned vehicle and the system user who is this driver
// (needed for the driver portal). Assigning ends the previous assignment.
const DriverAssignmentSection = ({ driver, pending = {}, onPending }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const canRead = useFleetPermission('vehicles.read');
  const canAssign = useFleetPermission('assignments.write');
  const canWriteDrivers = useFleetPermission('drivers.write');
  const canReadUsers = useFleetPermission('users.read');
  const canLink = canWriteDrivers && canReadUsers;
  const devices = useSelector((state) => state.devices.items);
  const [current, setCurrent] = useState(null);
  const [row, setRow] = useState(null);
  const [users, setUsers] = useState([]);

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
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
    if (!driver?.id) {
      return;
    }
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
  }, [canRead, canLink, driver?.id]);

  const options = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  // ADM-17: a vehicle another driver has is passed on only when that is confirmed (here, when
  // it is picked); the change itself waits for the form's save (ADM-14).
  const assign = useCatch(async (deviceId) => {
    if (deviceId) {
      const holder = await vehicleHolder(getFleetClient(), Number(deviceId));
      const own = holder && row && holder.driver_id === row.id;
      if (
        holder &&
        !own &&
        !(await confirm({
          title: t('fleetAssignTransferTitle'),
          message: t('fleetAssignTransfer')
            .replace('{0}', devices[deviceId]?.name || '')
            .replace('{1}', holder.driver?.full_name || ''),
          confirmLabel: t('fleetAssignTransferConfirm'),
          danger: false,
        }))
      ) {
        return;
      }
    }
    onPending({ ...pending, deviceId });
  });

  const link = (profileId) => onPending({ ...pending, profileId });

  const shownDevice =
    'deviceId' in pending
      ? pending.deviceId
      : current?.traccar_device_id
        ? String(current.traccar_device_id)
        : '';
  const shownProfile = 'profileId' in pending ? pending.profileId : row?.profile_id || '';
  const waiting = Object.keys(pending).length > 0;

  if (!canRead || !driver) {
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
          value={shownDevice}
          onChange={(event) => assign(event.target.value)}
          disabled={!canAssign}
          helperText={
            'deviceId' in pending
              ? t('fleetAssignPending')
              : current
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
            value={shownProfile}
            onChange={(event) => link(event.target.value)}
            helperText={'profileId' in pending ? t('fleetAssignPending') : t('fleetLinkedUserHint')}
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
      {!waiting && current?.traccar_device_id && row?.profile_id && (
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

import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { MenuItem, TextField, Typography } from '@mui/material';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import FormSection from '../../settings/components/FormSection';
import { ensureDriver, ensureVehicle } from '../fleetData';
import { assignDriver, grantMapAccess, linkedTraccarUser, vehicleHolder } from '../api/assignments';

// ADM-17: the vehicle's permanent driver, set from the vehicle's page too (the same link as on
// the driver's page). The driver's own user then sees the vehicle on the map.
const VehicleDriverSection = ({ device }) => {
  const t = useTranslation();
  const confirm = useConfirm();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('drivers.read');
  const canAssign = useFleetPermission('assignments.write');
  const drivers = useSelector((state) => state.drivers.items);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [holder, setHolder] = useState(undefined);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !device?.id) return;
    setHolder(await vehicleHolder(getFleetClient(), device.id));
  }, [canRead, device?.id, reloadKey]);

  const options = useMemo(
    () => Object.values(drivers).sort((a, b) => a.name.localeCompare(b.name)),
    [drivers],
  );

  const choose = useCatch(async (traccarDriverId) => {
    const client = getFleetClient();
    if (!traccarDriverId) {
      if (holder) await assignDriver({ client, profile, driverId: holder.driver_id });
      reload();
      return;
    }
    if (
      holder &&
      holder.driver?.traccar_driver_id !== Number(traccarDriverId) &&
      !(await confirm({
        title: t('fleetAssignTransferTitle'),
        message: t('fleetAssignTransfer')
          .replace('{0}', device.name)
          .replace('{1}', holder.driver?.full_name || ''),
        confirmLabel: t('fleetAssignTransferConfirm'),
        danger: false,
      }))
    ) {
      return;
    }
    // The drivers in the store are keyed by their identifier, not their id.
    const driver = options.find((item) => String(item.id) === traccarDriverId);
    const driverId = await ensureDriver(driver, profile);
    const vehicleId = await ensureVehicle(device, profile);
    await assignDriver({ client, profile, driverId, vehicleId });
    const traccarUserId = await linkedTraccarUser(
      client,
      (await client.from('drivers').select('profile_id').eq('id', driverId).maybeSingle()).data
        ?.profile_id,
    );
    await grantMapAccess(traccarUserId, device.id);
    reload();
  });

  if (!canRead || !device?.id) return null;

  const value = holder?.driver?.traccar_driver_id ? String(holder.driver.traccar_driver_id) : '';
  return (
    <FormSection
      title={t('fleetVehicleDriverTitle')}
      description={t('fleetVehicleDriverDescription')}
      icon={<BadgeRoundedIcon />}
    >
      <TextField
        select
        label={t('fleetVehicleDriver')}
        value={holder === undefined ? '' : value}
        onChange={(event) => choose(event.target.value)}
        disabled={!canAssign || holder === undefined}
        helperText={
          holder
            ? t('fleetAssignedSince').replace('{0}', formatTime(holder.starts_at, 'date'))
            : undefined
        }
      >
        <MenuItem value="">{t('fleetNoDriver')}</MenuItem>
        {/* A driver known only to the fleet database still shows by name. */}
        {value && !options.some((item) => String(item.id) === value) && (
          <MenuItem value={value}>{holder.driver?.full_name}</MenuItem>
        )}
        {options.map((driver) => (
          <MenuItem key={driver.id} value={String(driver.id)}>
            {driver.name}
          </MenuItem>
        ))}
      </TextField>
      {holder?.driver?.profile_id && (
        <Typography variant="body2" color="textSecondary">
          {t('fleetAssignSeesOnMap')}
        </Typography>
      )}
    </FormSection>
  );
};

export default VehicleDriverSection;

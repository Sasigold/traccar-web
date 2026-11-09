import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from '@mui/material';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../../common/util/permissions';
import { devicesActions } from '../../store';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { lookupVehicle, registryToFields, validPlate } from '../../common/fleet/govRegistry';
import { saveFleetRecord, useFleetAccess } from '../fleetRecords';

// "Update test dates from the registry" on the validity page: looks up every vehicle with a
// plate on data.gov.il and moves its test expiry to the registry's date, saved like a card save
// (Traccar, then the fleet database).
const GovRegistrySync = () => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const readonly = useDeviceReadonly();
  const fleet = useFleetAccess('vehicle');
  const devices = useSelector((state) => state.devices.items);

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(null);

  const candidates = Object.values(devices).filter((device) =>
    validPlate(device.attributes?.plateNumber),
  );

  const run = async () => {
    const result = { done: 0, total: candidates.length, updated: 0, notFound: 0, failed: 0 };
    setProgress({ ...result });
    for (const device of candidates) {
      try {
        const record = await lookupVehicle(device.attributes.plateNumber);
        const { testExpiry } = registryToFields(record);
        if (!record) {
          result.notFound += 1;
        } else if (testExpiry && testExpiry !== device.attributes.testExpiry) {
          const response = await fetchOrThrow(`api/devices/${device.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...device,
              attributes: { ...device.attributes, testExpiry },
            }),
          });

          const saved = await response.json();
          dispatch(devicesActions.update([saved]));
          if (fleet.write) {
            await saveFleetRecord('vehicle', saved, fleet.profile, {
              withDocuments: fleet.documents,
            });
          }
          result.updated += 1;
        }
      } catch {
        result.failed += 1;
      }
      result.done += 1;
      setProgress({ ...result });
    }
  };

  if (readonly || !candidates.length) {
    return null;
  }

  const running = progress && progress.done < progress.total;
  const close = () => {
    if (!running) {
      setOpen(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Button size="small" startIcon={<CloudSyncRoundedIcon />} onClick={() => setOpen(true)}>
        {t('govRegistrySync')}
      </Button>
      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{t('govRegistrySync')}</DialogTitle>
        <DialogContent>
          {!progress && (
            <DialogContentText>
              {t('govRegistrySyncText').replace('{0}', candidates.length)}
            </DialogContentText>
          )}
          {progress && (
            <>
              <LinearProgress
                variant="determinate"
                value={(progress.done / Math.max(progress.total, 1)) * 100}
                aria-label={t('govRegistrySync')}
              />
              {!running && (
                <Alert
                  severity={progress.failed ? 'warning' : 'success'}
                  sx={{ mt: 2 }}
                  role="status"
                >
                  {t('govRegistrySyncDone')
                    .replace('{0}', progress.updated)
                    .replace('{1}', progress.total)
                    .replace('{2}', progress.notFound)
                    .replace('{3}', progress.failed)}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={Boolean(running)}>
            {t(progress && !running ? 'a11yClose' : 'sharedCancel')}
          </Button>
          {!progress && (
            <Button variant="contained" onClick={run}>
              {t('govRegistrySyncStart')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GovRegistrySync;

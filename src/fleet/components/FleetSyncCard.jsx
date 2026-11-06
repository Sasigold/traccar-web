import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Button, LinearProgress, Typography } from '@mui/material';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FormSection from '../../settings/components/FormSection';
import { driverFieldKeys, vehicleFieldKeys } from '../../common/fleet/fleetFields';
import { hasFleetDetails } from '../../common/fleet/fleetSync';
import { saveFleetRecord, useFleetAccess } from '../fleetRecords';

// One-off copy of the stage 0 details (Traccar attributes) into the fleet database.
// Safe to run again: rows are upserted and validity documents are only added or moved.
const FleetSyncCard = () => {
  const t = useTranslation();
  const vehicles = useFleetAccess('vehicle');
  const drivers = useFleetAccess('driver');
  const devices = useSelector((state) => state.devices.items);
  const driverItems = useSelector((state) => state.drivers.items);

  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  if (!vehicles.write && !drivers.write) {
    return null;
  }

  const jobs = [
    ...(vehicles.write
      ? Object.values(devices)
          .filter((device) => hasFleetDetails(device.attributes, vehicleFieldKeys))
          .map((item) => ({ entity: 'vehicle', item, access: vehicles }))
      : []),
    ...(drivers.write
      ? Object.values(driverItems)
          .filter((driver) => hasFleetDetails(driver.attributes, driverFieldKeys))
          .map((item) => ({ entity: 'driver', item, access: drivers }))
      : []),
  ];

  const run = async () => {
    setResult(null);
    const errors = [];
    let done = 0;
    setProgress(0);
    for (const job of jobs) {
      try {
        await saveFleetRecord(job.entity, job.item, job.access.profile, {
          withDocuments: job.access.documents,
          keepExisting: true,
        });
      } catch (error) {
        errors.push(`${job.item.name}: ${error.message}`);
      }
      done += 1;
      setProgress((done / jobs.length) * 100);
    }
    setProgress(null);
    setResult({ saved: jobs.length - errors.length, errors });
  };

  return (
    <FormSection
      title={t('fleetSyncTitle')}
      description={t('fleetSyncDescription')}
      icon={<CloudSyncRoundedIcon />}
      actions={
        <Button variant="outlined" onClick={run} disabled={progress != null || !jobs.length}>
          {t('fleetSyncAction').replace('{0}', String(jobs.length))}
        </Button>
      }
    >
      {progress != null && <LinearProgress variant="determinate" value={progress} />}
      {result && (
        <Alert severity={result.errors.length ? 'warning' : 'success'}>
          {t('fleetSyncDone').replace('{0}', String(result.saved))}
          {result.errors.map((error) => (
            <Typography key={error} variant="body2">
              {error}
            </Typography>
          ))}
        </Alert>
      )}
    </FormSection>
  );
};

export default FleetSyncCard;

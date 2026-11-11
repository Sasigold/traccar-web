import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, AlertTitle, Link } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { dailyCheckRequired, missedChecks } from '../missedChecks';

// ADM-31: the vehicles that drove today without a morning check, when the organization has a
// daily checklist. Driving comes from Traccar's summary for today; each plate opens the vehicle.
const MissedChecks = () => {
  const t = useTranslation();
  const [missed, setMissed] = useState([]);

  useAsyncTask(async ({ signal }) => {
    // A side note: without Traccar's summary or the checklists, the page goes on without it.
    try {
      const client = getFleetClient();
      const templates = unwrap(
        await client.from('inspection_templates').select('frequency, active'),
      );
      if (!dailyCheckRequired(templates)) return undefined;
      const vehicles = (
        unwrap(await client.from('vehicles').select('id, plate_number, traccar_device_id')) || []
      ).filter((vehicle) => vehicle.traccar_device_id != null);
      if (!vehicles.length) return undefined;
      const start = dayjs().startOf('day');
      const inspections = unwrap(
        await client
          .from('inspections')
          .select('vehicle_id')
          .gte('started_at', start.toISOString()),
      );
      const query = new URLSearchParams({ from: start.toISOString(), to: dayjs().toISOString() });
      vehicles.forEach((vehicle) => query.append('deviceId', vehicle.traccar_device_id));
      const response = await fetchOrThrow(`api/reports/summary?${query}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
      setMissed(missedChecks(vehicles, await response.json(), inspections));
    } catch (error) {
      if (error.name === 'AbortError') throw error;
    }
    return undefined;
  }, []);

  if (!missed.length) return null;
  return (
    <Alert severity="warning" role="status">
      <AlertTitle>{t('inspectionMissedTitle').replace('{0}', missed.length)}</AlertTitle>
      {missed.map((vehicle, index) => (
        <span key={vehicle.id}>
          {index > 0 && ', '}
          <Link component={RouterLink} to={`/fleet/vehicle/${vehicle.traccar_device_id}`} dir="ltr">
            {vehicle.plate_number}
          </Link>
        </span>
      ))}
      <div>
        <Link component={RouterLink} to="/fleet/alerts">
          {t('inspectionMissedNotify')}
        </Link>
      </div>
    </Alert>
  );
};

export default MissedChecks;

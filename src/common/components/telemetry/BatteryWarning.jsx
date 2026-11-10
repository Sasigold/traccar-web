import { useState } from 'react';
import { Alert } from '@mui/material';
import { useTranslation } from '../LocalizationProvider';
import { useAsyncTask } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import { batteryHealth, crankVoltages } from '../../fleet/predict';

const DAYS = 3;

// AI-06: a 12V battery that sags at every start is about to leave the vehicle stranded. The
// last days' starts are read once per visit; nothing shows while the battery is fine.
const BatteryWarning = ({ deviceId }) => {
  const t = useTranslation();
  const [health, setHealth] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      const to = new Date();
      const from = new Date(to.getTime() - DAYS * 86400000);
      const query = new URLSearchParams({
        deviceId,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetchOrThrow(`api/reports/route?${query}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
      const positions = await response.json();
      if (!positions.some((position) => position.attributes?.power != null)) return;
      setHealth(batteryHealth(crankVoltages(positions)));
    },
    [deviceId],
  );

  if (!health || !['weak', 'watch'].includes(health.state)) return null;
  // The voltage stays left to right inside the Hebrew sentence.
  const [before, after] = t(health.state === 'weak' ? 'batteryWeak' : 'batteryWatch').split('{0}');
  return (
    <Alert severity={health.state === 'weak' ? 'warning' : 'info'} role="status">
      {before}
      <bdi dir="ltr">{health.median.toFixed(1)}</bdi>
      {after}
    </Alert>
  );
};

export default BatteryWarning;

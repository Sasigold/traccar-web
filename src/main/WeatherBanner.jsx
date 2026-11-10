import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import { useAsyncTask } from '../reactHelper';
import { cellsOf, risksByCell, speedFactor, weatherUrl } from '../common/fleet/weather';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 1, 1),
  },
}));

const REFRESH_MS = 15 * 60 * 1000;
// At most this many cells per request (Open-Meteo takes a list of points).
const MAX_CELLS = 50;
const ORDER = ['heavyRain', 'dust', 'rain', 'heat'];

// SAF-07: heavy rain, storms, dust or extreme heat where vehicles are now, with the stricter
// speed threshold for those conditions. Off unless "weatherAlerts" is set (it sends coarse
// cells of about 25 km to Open-Meteo; docs/PRIVACY-VENDORS.md).
const WeatherBanner = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const enabled = useAttributePreference('weatherAlerts', false);
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const [tick, setTick] = useState(0);
  const [risks, setRisks] = useState({});

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  const cells = useMemo(() => cellsOf(positions), [positions]);
  // Only a change of cells (or the clock) asks again, not every position update.
  const cellKey = Object.keys(cells).sort().join('|');

  useAsyncTask(
    async ({ signal }) => {
      void tick;
      if (!enabled || !cellKey) return;
      const list = cellKey.split('|').slice(0, MAX_CELLS);
      const response = await fetch(weatherUrl(list), { signal });
      if (!response.ok) return;
      setRisks(risksByCell(list, await response.json()));
    },
    [enabled, cellKey, tick],
  );

  if (!enabled) return null;

  // Vehicles per condition.
  const affected = {};
  Object.entries(risks).forEach(([cell, list]) => {
    list.forEach((risk) => {
      affected[risk] = [...(affected[risk] || []), ...(cells[cell] || [])];
    });
  });
  const shown = ORDER.filter((risk) => affected[risk]?.length);
  if (!shown.length) return null;

  const names = (ids) => {
    const list = ids.map((id) => devices[id]?.name).filter(Boolean);
    return list.length > 3 ? `${list.slice(0, 3).join(', ')} +${list.length - 3}` : list.join(', ');
  };

  return (
    <div className={classes.root} role="status">
      {shown.map((risk) => {
        const factor = speedFactor([risk]);
        return (
          <Alert key={risk} severity={risk === 'rain' ? 'info' : 'warning'}>
            {t(`weatherAlert_${risk}`).replace('{0}', names(affected[risk]))}
            {factor < 1 &&
              ` ${t('weatherSpeedFactor').replace('{0}', String(Math.round(factor * 100)))}`}
          </Alert>
        );
      })}
    </div>
  );
};

export default WeatherBanner;

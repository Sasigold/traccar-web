import { useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EvStationRoundedIcon from '@mui/icons-material/EvStationRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { formatTime } from '../../common/util/formatter';
import {
  batteryPercent,
  chargingSessions,
  rangeKm,
  sessionCost,
  sessionEnergy,
} from '../../common/fleet/ev';
import { money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  panel: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& > svg': { color: theme.palette.primary.main },
  },
  facts: {
    display: 'flex',
    gap: theme.spacing(3),
    flexWrap: 'wrap',
    fontVariantNumeric: 'tabular-nums',
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));

const DAYS = 7;

// OPS-09: an electric vehicle's charge, the range left and the charging of the last week, with
// what it cost. The battery size, consumption and kWh price are the device's attributes
// evCapacityKwh, evKwhPer100Km and evPricePerKwh.
const EvCard = ({ device, position }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [sessions, setSessions] = useState(null);
  const attributes = device?.attributes || {};
  const capacity = Number(attributes.evCapacityKwh) || null;
  const consumption = Number(attributes.evKwhPer100Km) || null;
  const price = Number(attributes.evPricePerKwh) || null;
  const level = batteryPercent(position);
  const electric = Boolean(capacity) || attributes.fuelType === 'electric';

  useAsyncTask(
    async ({ signal }) => {
      if (!electric || !device?.id) return;
      const to = new Date();
      const from = new Date(to.getTime() - DAYS * 24 * 3600 * 1000);
      const query = new URLSearchParams({
        deviceId: device.id,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query}`, { signal });
      setSessions(chargingSessions(await response.json()));
    },
    [electric, device?.id],
  );

  if (!electric) return null;
  const range = rangeKm(level, capacity, consumption);

  return (
    <Paper elevation={0} className={classes.panel} component="section" aria-labelledby="ev-title">
      <div className={classes.head}>
        <EvStationRoundedIcon />
        <Typography id="ev-title" variant="subtitle1" component="h2" fontWeight={600}>
          {t('evTitle')}
        </Typography>
      </div>
      <div className={classes.facts}>
        <Typography>{`${t('evCharge')}: ${level == null ? '—' : `${Math.round(level)}%`}`}</Typography>
        <Typography>
          {`${t('evRange')}: ${range == null ? t('evRangeSetup') : `${range} ${t('sharedKm')}`}`}
        </Typography>
      </div>
      {sessions?.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('evSession')}</TableCell>
              <TableCell>{t('evAdded')}</TableCell>
              <TableCell>{t('evCost')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((session) => {
              const energy = sessionEnergy(session, capacity);
              const cost = sessionCost(session, capacity, price);
              return (
                <TableRow key={session.start}>
                  <TableCell className={classes.number}>
                    {`${formatTime(session.start, 'minutes')} – ${formatTime(session.end, 'minutes')}`}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {`${session.from}% → ${session.to}%`}
                    {energy != null && ` · ${energy.toFixed(1)} kWh`}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {cost == null ? '—' : money(cost)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        sessions && (
          <Typography variant="body2" color="textSecondary">
            {t('evNoSessions')}
          </Typography>
        )
      )}
    </Paper>
  );
};

export default EvCard;

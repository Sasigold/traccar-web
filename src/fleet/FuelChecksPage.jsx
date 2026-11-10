import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  FUEL_RULES,
  RULE_FLAGS,
  idleCost,
  locationFinding,
  parkedDrops,
  rulesOn,
} from '../common/fleet/fuelChecks';
import { money } from './fleetData';
import FleetNotice from './components/FleetNotice';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  tiles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 0),
    },
  },
  tile: {
    minWidth: 160,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  rules: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  rule: {
    alignItems: 'flex-start',
    '& .MuiFormControlLabel-label': {
      paddingTop: theme.spacing(1),
    },
  },
  numbers: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
}));

const DAYS = 30;
const query = (deviceIds, from, to, extra = []) => {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  deviceIds.forEach((id) => params.append('deviceId', id));
  extra.forEach(([key, value]) => params.append(key, value));
  return params;
};
const json = async (path, signal) =>
  (await fetchOrThrow(path, { signal, headers: { Accept: 'application/json' } })).json();

// The replay around a moment: where the vehicle was.
const replayAround = (deviceId, moment) => {
  const at = Date.parse(moment);
  return `/replay?deviceId=${deviceId}&from=${encodeURIComponent(new Date(at - 15 * 60000).toISOString())}&to=${encodeURIComponent(new Date(at + 15 * 60000).toISOString())}`;
};

// OPS-02: fuel checks: a card used where the vehicle was not, more than the tank, the wrong
// fuel, fills too close together, and fuel leaving a parked vehicle; and idle in shekels.
const FuelChecksPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('costs.read');
  const canWrite = useFleetPermission('costs.write');
  const devices = useSelector((state) => state.devices.items);
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [settings, setSettings] = useState(null);
  const [data, setData] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const deviceIds = useMemo(() => Object.keys(devices).map(Number), [devices]);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      if (!canRead) return;
      const to = new Date();
      const from = new Date(to.getTime() - DAYS * 86400000);
      const client = getFleetClient();
      const [stored, transactions] = await Promise.all([
        client.from('org_fuel_settings').select('*').maybeSingle(),
        client
          .from('fuel_transactions')
          .select('*, vehicles(traccar_device_id)')
          .gte('occurred_at', from.toISOString())
          .order('occurred_at', { ascending: false })
          .limit(500),
      ]);
      const rows = unwrap(transactions) || [];
      setSettings(stored.data || { rules: {}, fuel_price: null, idle_liters_per_hour: 1 });
      if (!deviceIds.length) {
        setData({ rows, stops: [], drops: [], summaries: [], trips: [] });
        return;
      }
      const filled = [
        ...new Set(rows.map((row) => row.vehicles?.traccar_device_id).filter(Boolean)),
      ];
      const [stops, events, summaries, trips] = await Promise.all([
        filled.length ? json(`api/reports/stops?${query(filled, from, to)}`, signal) : [],
        json(
          `api/reports/events?${query(deviceIds, from, to, [['type', 'deviceFuelDrop']])}`,
          signal,
        ),
        json(`api/reports/summary?${query(deviceIds, from, to)}`, signal),
        json(`api/reports/trips?${query(deviceIds, from, to)}`, signal),
      ]);
      const positionIds = [...new Set(events.map((event) => event.positionId).filter(Boolean))];
      const positions = positionIds.length
        ? await json(
            `api/positions?${positionIds
              .slice(0, 200)
              .map((id) => `id=${id}`)
              .join('&')}`,
            signal,
          )
        : [];
      setData({
        rows,
        stops,
        drops: parkedDrops(events, Object.fromEntries(positions.map((item) => [item.id, item]))),
        summaries,
        trips,
      });
    },
    [canRead, deviceIds, reloadKey],
  );

  const rules = rulesOn(settings?.rules);

  const findings = useMemo(() => {
    if (!data) return [];
    const list = [];
    data.rows.forEach((row) => {
      const deviceId = row.vehicles?.traccar_device_id;
      Object.entries(RULE_FLAGS).forEach(([rule, flag]) => {
        if (rules[rule] && (row.anomaly_flags || []).includes(flag)) {
          list.push({ id: `${row.id}-${rule}`, rule, deviceId, time: row.occurred_at, row });
        }
      });
      if (rules.notAtVehicle && deviceId) {
        const found = locationFinding(
          row,
          data.stops.filter((stop) => stop.deviceId === deviceId),
        );
        if (found)
          list.push({ id: `${row.id}-location`, deviceId, time: row.occurred_at, row, ...found });
      }
    });
    if (rules.fuelDrop) {
      data.drops.forEach((drop, index) => list.push({ id: `drop-${index}`, ...drop }));
    }
    return list.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [data, rules]);

  const idle = useMemo(
    () =>
      data
        ? idleCost({
            summaries: data.summaries,
            trips: data.trips,
            price: Number(settings?.fuel_price) || null,
            litersPerHour: Number(settings?.idle_liters_per_hour) || 1,
          })
        : null,
    [data, settings],
  );

  const save = useCatch(async (changes) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    unwrap(
      await getFleetClient()
        .from('org_fuel_settings')
        .upsert({
          org_id: profile.org_id,
          rules: next.rules || {},
          fuel_price: next.fuel_price === '' ? null : Number(next.fuel_price) || null,
          fuel_price_month: next.fuel_price ? new Date().toISOString().slice(0, 8) + '01' : null,
          idle_liters_per_hour: Number(next.idle_liters_per_hour) || 1,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        }),
    );
  });

  const why = (finding) => {
    if (finding.rule === 'notAtVehicle') {
      return finding.reason === 'far'
        ? t('fuelWhyFar').replace('{0}', finding.km)
        : t('fuelWhyMoving');
    }
    return t(`fuelRule${capitalize(finding.rule)}Help`);
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fuelChecksTitle']}
      description={t('fuelChecksDescription')}
    >
      <FleetNotice permission="costs.read" />
      {data && (
        <div className={classes.tiles}>
          <div className={classes.tile} role="status">
            <Typography variant="caption" color="textSecondary">
              {t('fuelChecksFindings')}
            </Typography>
            <div className={classes.value}>{findings.length}</div>
          </div>
          <div className={classes.tile}>
            <Typography variant="caption" color="textSecondary">
              {t('fuelIdleCost')}
            </Typography>
            <div className={classes.value}>
              {idle?.total != null
                ? money(idle.total)
                : `${idle?.hours ?? 0} ${t('sharedHourAbbreviation')}`}
            </div>
            <Typography variant="caption" color="textSecondary">
              {idle?.total != null
                ? t('fuelIdleHelp').replace('{0}', idle.hours)
                : t('fuelIdleNoPrice')}
            </Typography>
          </div>
        </div>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            count={findings.length}
            actions={
              <Button
                size="small"
                startIcon={<TuneRoundedIcon />}
                onClick={() => setRulesOpen(true)}
              >
                {t('fuelChecksRules')}
              </Button>
            }
          />
        }
        empty={Boolean(data) && findings.length === 0}
        emptyState={{ icon: <LocalGasStationRoundedIcon />, title: t('fuelChecksNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetFuelFieldOccurredAt')}</TableCell>
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell>{t('fuelChecksCheck')}</TableCell>
            <TableCell>{t('fuelChecksWhy')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {canRead && !data && <TableShimmer columns={5} />}
          {findings.slice(0, 300).map((finding) => (
            <TableRow key={finding.id} hover>
              <TableCell>{formatTime(finding.time, 'minutes')}</TableCell>
              <TableCell>
                {devices[finding.deviceId]?.name || finding.row?.plate_number || '—'}
              </TableCell>
              <TableCell>{t(`fuelRule${capitalize(finding.rule)}`)}</TableCell>
              <TableCell>{why(finding)}</TableCell>
              <TableCell>
                {finding.deviceId && (
                  <Link component={RouterLink} to={replayAround(finding.deviceId, finding.time)}>
                    {t('fuelWhereWasIt')}
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {settings && rulesOpen && (
        <Dialog open onClose={() => setRulesOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t('fuelChecksRules')}</DialogTitle>
          <DialogContent>
            <div className={classes.rules}>
              {FUEL_RULES.map((rule) => (
                <FormControlLabel
                  key={rule}
                  className={classes.rule}
                  control={
                    <Switch
                      checked={rules[rule]}
                      disabled={!canWrite}
                      onChange={(event) =>
                        save({ rules: { ...settings.rules, [rule]: event.target.checked } })
                      }
                    />
                  }
                  label={
                    <>
                      <Typography>{t(`fuelRule${capitalize(rule)}`)}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {t(`fuelRule${capitalize(rule)}Help`)}
                      </Typography>
                    </>
                  }
                />
              ))}
              <div className={classes.numbers}>
                <TextField
                  type="number"
                  label={t('fuelPrice')}
                  helperText={t('fuelPriceHelp')}
                  defaultValue={settings.fuel_price ?? ''}
                  disabled={!canWrite}
                  onBlur={(event) => save({ fuel_price: event.target.value })}
                  slotProps={{
                    htmlInput: { min: 0, step: 0.01, dir: 'ltr', inputMode: 'decimal' },
                  }}
                />
                <TextField
                  type="number"
                  label={t('fuelIdleRate')}
                  defaultValue={settings.idle_liters_per_hour ?? 1}
                  disabled={!canWrite}
                  onBlur={(event) => save({ idle_liters_per_hour: event.target.value })}
                  slotProps={{
                    htmlInput: { min: 0.1, step: 0.1, dir: 'ltr', inputMode: 'decimal' },
                  }}
                />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setRulesOpen(false);
                reload();
              }}
            >
              {t('fuelChecksRecheck')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageLayout>
  );
};

export default FuelChecksPage;

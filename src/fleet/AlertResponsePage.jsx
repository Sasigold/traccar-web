import { useState } from 'react';
import {
  Button,
  Chip,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useInvalidateFleet } from '../common/data/fleetQuery';
import { useAlertCaseAccess, useAlertCases } from '../common/fleet/useAlertCases';
import { responseStats } from '../common/fleet/alertCases';
import FleetNotice from './components/FleetNotice';

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
    minWidth: 150,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  target: {
    marginBottom: theme.spacing(2),
    alignItems: 'center',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2),
    },
  },
}));

const PERIODS = [7, 30];
const percent = (value) => (value == null ? '—' : `${Math.round(value * 100)}%`);
const minutes = (value) => (value == null ? '—' : Math.round(value));

// LIV-24: how fast alerts are taken: the median, the share within the target, per person.
const AlertResponsePage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const access = useAlertCaseAccess();
  const canManage = useFleetPermission('alerts.manage');
  const profile = useFleetProfile();
  const invalidate = useInvalidateFleet();
  const [days, setDays] = useState(7);
  const { cases, slaMinutes, people } = useAlertCases(days, access);
  const [target, setTarget] = useState(null);

  const stats = responseStats(cases, slaMinutes);
  const nameOf = (id) => people.find((person) => person.id === id)?.full_name || '—';

  const saveTarget = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('org_alert_settings')
        .upsert({ org_id: profile.org_id, sla_minutes: Number(target) }, { onConflict: 'org_id' }),
    );
    invalidate('org_alert_settings');
    setTarget(null);
  });

  const tiles = [
    ['alertResponseTotal', stats.total],
    ['alertResponseOpen', stats.open],
    ['alertResponseMedian', minutes(stats.medianMinutes)],
    ['alertResponseWithin', percent(stats.withinSla)],
    ['alertResponseTarget', slaMinutes],
  ];

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'alertResponseTitle']}
      description={t('alertResponseDescription').replace('{0}', slaMinutes)}
    >
      <FleetNotice permission="alerts.read" />
      <div className={classes.tiles}>
        {tiles.map(([key, value]) => (
          <div key={key} className={classes.tile} role="status">
            <Typography variant="caption" color="textSecondary">
              {t(key)}
            </Typography>
            <div className={classes.value}>{value}</div>
          </div>
        ))}
      </div>
      {canManage && (
        <Stack direction="row" spacing={1} className={classes.target}>
          <TextField
            size="small"
            type="number"
            label={t('alertResponseTarget')}
            value={target ?? slaMinutes}
            onChange={(e) => setTarget(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: 1440, dir: 'ltr' } }}
            sx={{ width: 180 }}
          />
          <Button
            onClick={saveTarget}
            disabled={target == null || !(Number(target) >= 1 && Number(target) <= 1440)}
          >
            {t('sharedSave')}
          </Button>
        </Stack>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            count={stats.people.length}
            filters={PERIODS.map((value) => (
              <Chip
                key={value}
                size="small"
                label={t('alertResponseDays').replace('{0}', value)}
                color={days === value ? 'primary' : 'default'}
                variant={days === value ? 'filled' : 'outlined'}
                aria-pressed={days === value}
                onClick={() => setDays(value)}
              />
            ))}
          />
        }
        empty={stats.people.length === 0}
        emptyState={{ icon: <TimerRoundedIcon />, title: t('alertResponseNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('alertCaseAssignee')}</TableCell>
            <TableCell>{t('alertResponseCount')}</TableCell>
            <TableCell>{t('alertResponseMedian')}</TableCell>
            <TableCell>{t('alertResponseWithin')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stats.people.map((person) => (
            <TableRow key={person.id} hover>
              <TableCell>{nameOf(person.id)}</TableCell>
              <TableCell>{person.count}</TableCell>
              <TableCell>{minutes(person.medianMinutes)}</TableCell>
              <TableCell>{percent(person.withinSla)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default AlertResponsePage;

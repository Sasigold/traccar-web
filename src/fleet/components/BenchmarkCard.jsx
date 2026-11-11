import { useReducer, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import { money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  root: {
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
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));

const MIN_FLEETS = 5;

// How each metric reads (all are "lower is better").
const FORMAT = {
  fuel_cost_per_vehicle_month: (value) => money(Math.round(value)),
  maintenance_cost_per_vehicle_month: (value) => money(Math.round(value)),
  incidents_per_100_vehicles_year: (value) => value.toFixed(1),
  failed_check_share: (value) => `${Math.round(value * 100)}%`,
  violations_per_10_drivers_year: (value) => value.toFixed(1),
};

// AI-09: this fleet against the median and the best tenth of similar fleets (same size band),
// for organizations that agreed to take part. Only aggregates of at least five other fleets.
const BenchmarkCard = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('costs.read');
  const canManage = useFleetPermission('users.manage');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [state, setState] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !profile?.org_id) return;
    const client = getFleetClient();
    const org = unwrap(
      await client
        .from('organizations')
        .select('benchmark_opt_in')
        .eq('id', profile.org_id)
        .maybeSingle(),
    );
    const optedIn = Boolean(org?.benchmark_opt_in);
    const rows = optedIn ? unwrap(await client.rpc('fleet_benchmarks')) || [] : [];
    setState({ optedIn, rows });
  }, [canRead, profile?.org_id, reloadKey]);

  const join = useCatch(async () => {
    if (
      !(await confirm({
        title: t('benchmarkJoin'),
        message: t('benchmarkConsent'),
        confirmLabel: t('benchmarkJoin'),
        danger: false,
      }))
    ) {
      return;
    }
    unwrap(await getFleetClient().rpc('set_benchmark_opt_in', { p_opt_in: true }));
    reload();
  });

  if (!canRead || !state) return null;
  if (!state.optedIn && !canManage) return null;

  const shown = state.rows.filter((row) => FORMAT[row.metric]);
  const compared = shown.filter((row) => row.median != null);

  return (
    <Paper
      elevation={0}
      className={classes.root}
      component="section"
      aria-labelledby="benchmark-title"
    >
      <div className={classes.head}>
        <CompareArrowsRoundedIcon />
        <Typography id="benchmark-title" variant="subtitle1" component="h2" fontWeight={600}>
          {t('benchmarkTitle')}
        </Typography>
      </div>
      {!state.optedIn ? (
        <>
          <Typography variant="body2" color="textSecondary">
            {t('benchmarkExplain')}
          </Typography>
          <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={join}>
            {t('benchmarkJoin')}
          </Button>
        </>
      ) : compared.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('benchmarkMetric')}</TableCell>
              <TableCell>{t('benchmarkYou')}</TableCell>
              <TableCell>{t('benchmarkMedian')}</TableCell>
              <TableCell>{t('benchmarkBest')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {compared.map((row) => {
              const format = FORMAT[row.metric];
              const mine = Number(row.mine);
              const better = mine <= Number(row.median);
              return (
                <TableRow key={row.metric}>
                  <TableCell>{t(`benchmark_${row.metric}`)}</TableCell>
                  <TableCell className={classes.number}>{format(mine)}</TableCell>
                  <TableCell className={classes.number}>{format(Number(row.median))}</TableCell>
                  <TableCell className={classes.number}>{format(Number(row.best))}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={better ? 'success' : 'warning'}
                      label={t(better ? 'benchmarkBetter' : 'benchmarkWorse')}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Alert severity="info">
          {t('benchmarkTooFew')
            .replace('{0}', String(Math.max(0, ...shown.map((row) => row.fleets))))
            .replace('{1}', String(MIN_FLEETS))}
        </Alert>
      )}
    </Paper>
  );
};

export default BenchmarkCard;

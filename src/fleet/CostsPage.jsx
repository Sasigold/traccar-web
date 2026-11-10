import { useMemo, useReducer, useState } from 'react';
import {
  Button,
  Chip,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';
import FuelEntryDialog from './components/FuelEntryDialog';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { periodStart, pivotCosts, withCostPerKm } from '../common/fleet/costs';
import fetchOrThrow from '../common/util/fetchOrThrow';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FleetNotice from './components/FleetNotice';
import FuelImportDialog, { fuelFlagKey } from './components/FuelImportDialog';
import ExpenseDialog, { expenseCategoryKey } from './components/ExpenseDialog';
import { money, openFleetFile, useVehicleIndex } from './fleetData';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  totals: {
    '& .MuiTableCell-root': {
      fontWeight: 700,
      backgroundColor: theme.palette.surface.tint,
    },
  },
  flags: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  period: {
    minWidth: 150,
  },
}));

const views = ['summary', 'fuel', 'expenses'];
const periods = [1, 3, 6, 12];

// Fuel and other costs per vehicle, the fuel company import and expenses.
const CostsPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const canRead = useFleetPermission('costs.read');
  const canWrite = useFleetPermission('costs.write');
  const vehicleIndex = useVehicleIndex(canRead);
  const profile = useFleetProfile();
  const confirm = useConfirm();

  const [view, setView] = useState('summary');
  const [months, setMonths] = useState(3);
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  // The rows are kept with the view they were read for, so a view never shows another's rows.
  const [loaded, setLoaded] = useState({ view: null, rows: null });
  const rows = loaded.view === view ? loaded.rows : null;
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  // ADM-18: a vehicle picked in the summary narrows the fuel and expense lists to it.
  const [vehicleFilter, setVehicleFilter] = useState(null);
  const [meters, setMeters] = useState(null);

  const from = periodStart(months);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    if (view === 'summary') {
      setLoaded({
        view,
        rows:
          unwrap(await client.from('vehicle_monthly_costs').select('*').gte('month', from)) || [],
      });
    } else if (view === 'fuel') {
      setLoaded({
        view,
        rows:
          unwrap(
            await client
              .from('fuel_transactions')
              .select('*')
              .gte('occurred_at', from)
              .order('occurred_at', { ascending: false })
              .limit(1000),
          ) || [],
      });
    } else {
      setLoaded({
        view,
        rows:
          unwrap(
            await client
              .from('vehicle_expenses')
              .select('*')
              .gte('occurred_at', from)
              .order('occurred_at', { ascending: false })
              .limit(1000),
          ) || [],
      });
    }
  }, [view, from, canRead, reloadKey]);

  // ADM-18: the distance each vehicle drove in the period (Traccar's summary), for ₪/km.
  const traccarIds = Object.values(vehicleIndex)
    .map((vehicle) => vehicle.traccarId)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .join(',');
  useAsyncTask(
    async ({ signal }) => {
      setMeters(null);
      if (view !== 'summary' || !traccarIds) return;
      const query = new URLSearchParams({
        from: new Date(from).toISOString(),
        to: new Date().toISOString(),
      });
      traccarIds.split(',').forEach((id) => query.append('deviceId', id));
      try {
        const response = await fetchOrThrow(`api/reports/summary?${query}`, {
          signal,
          headers: { Accept: 'application/json' },
        });
        const byTraccar = {};
        (await response.json()).forEach((row) => {
          byTraccar[row.deviceId] = (byTraccar[row.deviceId] || 0) + (row.distance || 0);
        });
        setMeters(
          Object.fromEntries(
            Object.entries(vehicleIndex).map(([id, vehicle]) => [id, byTraccar[vehicle.traccarId]]),
          ),
        );
      } catch {
        // Without the distance the column stays empty; the costs still show.
        setMeters({});
      }
    },
    [view, from, traccarIds, vehicleIndex],
  );

  const plate = (vehicleId, fallback) => vehicleIndex[vehicleId]?.plate || fallback || '—';

  const summary = useMemo(() => {
    if (view !== 'summary' || !rows) return null;
    const pivot = pivotCosts(rows);
    return { ...pivot, lines: withCostPerKm(pivot.lines, meters) };
  }, [view, rows, meters]);
  const visibleRows = useMemo(
    () =>
      (view === 'fuel' && anomaliesOnly
        ? (rows || []).filter((row) => row.anomaly_flags?.length && !row.reviewed_at)
        : rows || []
      ).filter((row) => !vehicleFilter || row.vehicle_id === vehicleFilter),
    [view, rows, anomaliesOnly, vehicleFilter],
  );

  // ADM-18: an anomaly someone checked stops asking for attention (who and when are kept).
  const markReviewed = useCatch(async (row) => {
    unwrap(
      await getFleetClient()
        .from('fuel_transactions')
        .update({ reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
        .eq('id', row.id),
    );
    reload();
  });

  const removeFuel = useCatch(async (row) => {
    if (
      !(await confirm({
        title: t('fleetFuelDeleteConfirm'),
        message: `${formatTime(row.occurred_at, 'minutes')} · ${money(row.total)}`,
        confirmLabel: t('sharedRemove'),
      }))
    ) {
      return;
    }
    unwrap(await getFleetClient().from('fuel_transactions').delete().eq('id', row.id));
    reload();
  });

  const removeExpense = useCatch(async (row) => {
    if (
      !(await confirm({
        title: t('fleetExpenseDeleteConfirm'),
        message: `${formatTime(row.occurred_at, 'date')} · ${money(row.amount)}`,
        confirmLabel: t('sharedRemove'),
      }))
    ) {
      return;
    }
    unwrap(await getFleetClient().from('vehicle_expenses').delete().eq('id', row.id));
    reload();
  });

  const handleExport = async () => {
    let data;
    if (view === 'summary') {
      data = summary.lines.map((line) => ({
        [t('fleetEntityVehicle')]: plate(line.vehicleId),
        [t('fleetCostFuel')]: line.fuel,
        [t('fleetCostMaintenance')]: line.maintenance,
        [t('fleetCostOther')]: line.other,
        [t('fleetWorkOrderTotal')]: line.total,
        [t('fleetCostPerKm')]: line.perKm ?? '',
      }));
    } else if (view === 'fuel') {
      data = visibleRows.map((row) => ({
        [t('fleetFuelFieldOccurredAt')]: formatTime(row.occurred_at, 'minutes'),
        [t('fleetEntityVehicle')]: plate(row.vehicle_id, row.plate_number),
        [t('fleetFuelFieldStation')]: row.station,
        [t('fleetFuelFieldLiters')]: row.liters == null ? '' : Number(row.liters),
        [t('fleetFuelFieldTotal')]: Number(row.total),
        [t('fleetFuelAnomalies')]: (row.anomaly_flags || [])
          .map((flag) => t(fuelFlagKey(flag)))
          .join(', '),
      }));
    } else {
      data = visibleRows.map((row) => ({
        [t('fleetExpenseDate')]: formatTime(row.occurred_at, 'date'),
        [t('fleetEntityVehicle')]: plate(row.vehicle_id),
        [t('fleetExpenseCategory')]: t(expenseCategoryKey(row.category)),
        [t('fleetExpenseAmount')]: Number(row.amount),
        [t('fleetExpenseReference')]: row.reference,
      }));
    }
    const sheets = new Map();
    sheets.set(t(`fleetCostsView${capitalize(view)}`), data);
    await exportExcel(t('fleetCostsPage'), `costs-${view}.xlsx`, sheets, theme);
  };

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(`fleetCostsView${capitalize(key)}`)}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => setView(key)}
    />
  ));
  if (vehicleFilter && view !== 'summary') {
    viewChips.push(
      <Chip
        key="vehicle"
        size="small"
        color="primary"
        label={
          <>
            {t('fleetEntityVehicle')}: <span dir="ltr">{plate(vehicleFilter)}</span>
          </>
        }
        onDelete={() => setVehicleFilter(null)}
      />,
    );
  }
  if (view === 'fuel') {
    viewChips.push(
      <Chip
        key="anomalies"
        size="small"
        label={t('fleetFuelAnomaliesOnly')}
        color={anomaliesOnly ? 'primary' : 'default'}
        variant={anomaliesOnly ? 'filled' : 'outlined'}
        onClick={() => setAnomaliesOnly(!anomaliesOnly)}
      />,
    );
  }

  const actions = (
    <>
      <TextField
        select
        size="small"
        className={classes.period}
        label={t('fleetCostsPeriod')}
        value={months}
        onChange={(event) => setMonths(Number(event.target.value))}
      >
        {periods.map((value) => (
          <MenuItem key={value} value={value}>
            {t('fleetCostsMonths').replace('{0}', String(value))}
          </MenuItem>
        ))}
      </TextField>
      {canWrite && view === 'fuel' && (
        <Button variant="outlined" size="small" onClick={() => setDialog('manualFuel')}>
          {t('fleetFuelManual')}
        </Button>
      )}
      {canWrite && view === 'fuel' && (
        <Button
          variant="contained"
          size="small"
          startIcon={<UploadFileRoundedIcon />}
          onClick={() => setDialog('fuel')}
        >
          {t('fleetFuelImport')}
        </Button>
      )}
      {canWrite && view === 'expenses' && (
        <Button variant="contained" size="small" onClick={() => setDialog('expense')}>
          {t('fleetExpenseAdd')}
        </Button>
      )}
    </>
  );

  const count = view === 'summary' ? summary?.lines.length : rows ? visibleRows.length : undefined;

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetCostsPage']}
      description={t('fleetCostsPageDescription')}
    >
      <FleetNotice permission="costs.read" />
      <DataTable
        toolbar={
          <TableToolbar
            count={count}
            filters={viewChips}
            actions={actions}
            exportHandler={rows ? handleExport : undefined}
          />
        }
        empty={
          rows != null &&
          (view === 'summary' ? summary.lines.length === 0 : visibleRows.length === 0)
        }
        emptyState={{ icon: <PaymentsRoundedIcon />, title: t('fleetCostsNone') }}
      >
        {view === 'summary' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('fleetCostFuel')}</TableCell>
                <TableCell>{t('fleetCostMaintenance')}</TableCell>
                <TableCell>{t('fleetCostOther')}</TableCell>
                <TableCell>{t('fleetWorkOrderTotal')}</TableCell>
                <TableCell>{t('fleetCostPerKm')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={6} />}
              {summary?.lines.map((line) => (
                <TableRow key={line.vehicleId} hover>
                  <TableCell>
                    {/* ADM-18: the vehicle opens its fuel (or other expenses) in this period. */}
                    <Button
                      size="small"
                      sx={{ minWidth: 0, px: 0.5 }}
                      aria-label={t('fleetCostsVehicleRows').replace('{0}', plate(line.vehicleId))}
                      onClick={() => {
                        setVehicleFilter(line.vehicleId);
                        setView(line.fuel > 0 ? 'fuel' : 'expenses');
                      }}
                    >
                      <span dir="ltr">{plate(line.vehicleId)}</span>
                    </Button>
                  </TableCell>
                  <TableCell className={classes.number}>{money(line.fuel)}</TableCell>
                  <TableCell className={classes.number}>{money(line.maintenance)}</TableCell>
                  <TableCell className={classes.number}>{money(line.other)}</TableCell>
                  <TableCell className={classes.number}>{money(line.total)}</TableCell>
                  <TableCell className={classes.number}>
                    {line.perKm == null ? '—' : money(line.perKm)}
                  </TableCell>
                </TableRow>
              ))}
              {summary?.lines.length > 0 && (
                <TableRow className={classes.totals}>
                  <TableCell>{t('fleetWorkOrderTotal')}</TableCell>
                  <TableCell className={classes.number}>{money(summary.totals.fuel)}</TableCell>
                  <TableCell className={classes.number}>
                    {money(summary.totals.maintenance)}
                  </TableCell>
                  <TableCell className={classes.number}>{money(summary.totals.other)}</TableCell>
                  <TableCell className={classes.number}>{money(summary.totals.total)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </>
        )}
        {view === 'fuel' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetFuelFieldOccurredAt')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('fleetFuelFieldStation')}</TableCell>
                <TableCell>{t('fleetFuelFieldLiters')}</TableCell>
                <TableCell>{t('fleetFuelFieldTotal')}</TableCell>
                <TableCell>{t('fleetFuelAnomalies')}</TableCell>
                {canWrite && <TableCell aria-label={t('shellActions')} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={canWrite ? 7 : 6} />}
              {visibleRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell className={classes.number}>
                    {formatTime(row.occurred_at, 'minutes')}
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{plate(row.vehicle_id, row.plate_number)}</span>
                  </TableCell>
                  <TableCell>
                    {row.station}
                    {/* ADM-18: the receipt a driver photographed with the fueling. */}
                    {row.receipt_path && (
                      <Button size="small" onClick={() => openFleetFile(row.receipt_path)}>
                        {t('fleetExpenseReceipt')}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>{row.liters}</TableCell>
                  <TableCell className={classes.number}>{money(row.total)}</TableCell>
                  <TableCell>
                    <span className={classes.flags}>
                      {(row.anomaly_flags || []).map((flag) => (
                        <Chip
                          key={flag}
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={t(fuelFlagKey(flag))}
                        />
                      ))}
                      {row.anomaly_flags?.length > 0 &&
                        (row.reviewed_at ? (
                          <Chip
                            size="small"
                            color="success"
                            variant="outlined"
                            label={t('fleetFuelReviewed')}
                            title={formatTime(row.reviewed_at, 'minutes')}
                          />
                        ) : (
                          canWrite && (
                            <Button size="small" onClick={() => markReviewed(row)}>
                              {t('fleetFuelMarkReviewed')}
                            </Button>
                          )
                        ))}
                    </span>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <IconButton
                        size="small"
                        aria-label={t('sharedRemove')}
                        onClick={() => removeFuel(row)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'expenses' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetExpenseDate')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('fleetExpenseCategory')}</TableCell>
                <TableCell>{t('fleetExpenseAmount')}</TableCell>
                <TableCell>{t('fleetExpenseReference')}</TableCell>
                <TableCell>{t('fleetExpenseReceipt')}</TableCell>
                {canWrite && <TableCell aria-label={t('shellActions')} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={canWrite ? 7 : 6} />}
              {visibleRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell className={classes.number}>
                    {formatTime(row.occurred_at, 'date')}
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{plate(row.vehicle_id)}</span>
                  </TableCell>
                  <TableCell>{t(expenseCategoryKey(row.category))}</TableCell>
                  <TableCell className={classes.number}>{money(row.amount)}</TableCell>
                  <TableCell>{row.reference}</TableCell>
                  <TableCell>
                    {row.receipt_path && (
                      <Button size="small" onClick={() => openFleetFile(row.receipt_path)}>
                        {t('fleetOpenFile')}
                      </Button>
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedEdit')}
                        onClick={() => setEditing(row)}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={t('sharedRemove')}
                        onClick={() => removeExpense(row)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      {dialog === 'fuel' && (
        <FuelImportDialog onClose={() => setDialog(null)} onImported={reload} />
      )}
      {dialog === 'manualFuel' && (
        <FuelEntryDialog
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {editing && (
        <ExpenseDialog
          expense={editing}
          deviceId={vehicleIndex[editing.vehicle_id]?.traccarId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {dialog === 'expense' && (
        <ExpenseDialog
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default CostsPage;

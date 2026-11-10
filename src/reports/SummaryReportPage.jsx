import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  Link,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { delta, formatDelta, previousRange } from './common/compare';
import { useTheme } from '@mui/material/styles';
import {
  formatDistance,
  formatSpeed,
  formatVolume,
  formatTime,
  formatNumericHours,
} from '../common/util/formatter';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { useAttributePreference } from '../common/util/preferences';
import { summaryTripsLink } from './components/reportLinks';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import usePersistedState from '../common/util/usePersistedState';
import ColumnSelect from './components/ColumnSelect';
import ReportKpis from './components/ReportKpis';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import { useCatch, useRunCallback } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import {
  ReportEmptyRow,
  ReportTotalsRow,
  SortCell,
  useReportSort,
} from './components/ReportTableParts';
import DataTable from '../common/components/table/DataTable';
import scheduleReport from './common/scheduleReport';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';
import { plateOf, vehicleName } from './common/vehicle';
import {
  activeDaysByDevice,
  distancePerDay,
  drivingByDevice,
  fuelPer100,
  idlePercent,
} from './common/summaryExtras';
import DailyDistanceChart from './components/DailyDistanceChart';
import { alignOf, NUMERIC_COLUMNS } from './common/numericColumns';

const columnsArray = [
  ['startTime', 'reportStartDate'],
  ['distance', 'sharedDistance'],
  ['startOdometer', 'reportStartOdometer'],
  ['endOdometer', 'reportEndOdometer'],
  ['averageSpeed', 'reportAverageSpeed'],
  ['maxSpeed', 'reportMaximumSpeed'],
  ['engineHours', 'reportEngineHours'],
  ['startHours', 'reportStartEngineHours'],
  ['endHours', 'reportEndEngineHours'],
  ['spentFuel', 'reportSpentFuel'],
  // REP-14: days on the road, consumption and idling.
  ['activeDays', 'reportActiveDays'],
  ['fuelPer100', 'reportFuelPer100'],
  ['idlePercent', 'reportIdlePercent'],
];
const columnsMap = new Map(columnsArray);
// The columns that compare with the previous period.
const COMPARED = ['distance', 'averageSpeed', 'maxSpeed', 'engineHours', 'spentFuel'];

// The totals row: distances, engine hours and fuel add up; speeds take the top or the
// mean weighted by engine hours.
const TOTALS = {
  distance: 'sum',
  engineHours: 'sum',
  spentFuel: 'sum',
  maxSpeed: 'max',
  averageSpeed: 'avg:engineHours',
};

const SummaryReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));

  const distanceUnit = useAttributePreference('distanceUnit');
  const speedUnit = useAttributePreference('speedUnit');
  const volumeUnit = useAttributePreference('volumeUnit');

  const [columns, setColumns] = usePersistedState('summaryColumns', [
    'startTime',
    'distance',
    'averageSpeed',
  ]);
  const daily = searchParams.get('daily') === 'true';
  const [items, setItems] = useState([]);
  // REP-09: the same vehicles in the period right before, for the change in each column.
  const [compare, setCompare] = usePersistedState('summaryCompare', false);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  // REP-14: the period day by day, for the chart and the active days.
  const [days, setDays] = useState(null);
  const wantIdle = columns.includes('idlePercent');

  const onShow = useRunCallback(
    async ({ deviceIds, groupIds, from, to, signal }) => {
      const query = new URLSearchParams({ from, to, daily });
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      groupIds.forEach((groupId) => query.append('groupId', groupId));
      setLoading(true);
      try {
        const response = await fetchOrThrow(`api/reports/summary?${query.toString()}`, {
          signal,
          headers: { Accept: 'application/json' },
        });
        const rows = await response.json();
        const span = (Date.parse(to) - Date.parse(from)) / 86400000;
        let dailyRows = daily ? rows : null;
        if (!daily && span > 1 && span <= 93) {
          const dayQuery = new URLSearchParams(query);
          dayQuery.set('daily', 'true');
          dailyRows = await fetchOrThrow(`api/reports/summary?${dayQuery}`, {
            signal,
            headers: { Accept: 'application/json' },
          }).then((result) => result.json());
        }
        // Idling needs the driving time, from the trips: only when the column is shown.
        let driving = null;
        if (wantIdle) {
          const tripQuery = new URLSearchParams(query);
          tripQuery.delete('daily');
          driving = drivingByDevice(
            await fetchOrThrow(`api/reports/trips?${tripQuery}`, {
              signal,
              headers: { Accept: 'application/json' },
            }).then((result) => result.json()),
          );
        }
        const active = !daily && dailyRows ? activeDaysByDevice(dailyRows) : null;
        setItems(
          rows.map((row) => ({
            ...row,
            activeDays: active ? active.get(row.deviceId) || 0 : null,
            fuelPer100: fuelPer100(row.spentFuel, row.distance),
            idlePercent: driving
              ? idlePercent(row.engineHours, driving.get(row.deviceId) || 0)
              : null,
          })),
        );
        setDays(dailyRows && span > 1 && span <= 93 ? distancePerDay(dailyRows, from, to) : null);
        if (compare && !daily) {
          const before = previousRange(from, to);
          query.set('from', before.from);
          query.set('to', before.to);
          const previousResponse = await fetchOrThrow(`api/reports/summary?${query.toString()}`, {
            signal,
            headers: { Accept: 'application/json' },
          });
          const previousRows = await previousResponse.json();
          setPrevious(new Map(previousRows.map((row) => [row.deviceId, row])));
        } else {
          setPrevious(null);
        }
      } finally {
        setLoading(false);
        setQueried(true);
      }
    },
    [daily, compare, wantIdle],
  );

  const onExport = useCatch(async () => {
    const rows = [];
    const deviceHeader = t('sharedDevice');
    items.forEach((item) => {
      const row = {
        [deviceHeader]: vehicleName(devices, item.deviceId),
        [t('reportPlate')]: plateOf(devices[item.deviceId]),
      };
      columns.forEach((key) => {
        const header = t(columnsMap.get(key));
        row[header] = formatValue(item, key);
      });
      rows.push(row);
    });
    if (rows.length === 0) {
      return;
    }
    const titleKey = daily ? 'reportDaily' : 'reportSummary';
    const title = t(titleKey);
    const sheets = new Map([[title, rows]]);
    await exportExcel(title, 'summary.xlsx', sheets, theme, {
      totals: [t('sharedDistance'), t('reportSpentFuel')],
    });
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'summary';
    report.attributes.daily = daily;
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const kpis = useMemo(() => {
    if (!items.length) {
      return [];
    }
    const sum = (key) => items.reduce((total, item) => total + (item[key] || 0), 0);
    const maxSpeed = Math.max(0, ...items.map((item) => item.maxSpeed || 0));
    const engineHours = sum('engineHours');
    const spentFuel = sum('spentFuel');
    return [
      {
        key: 'distance',
        label: `${t('sharedTotal')} · ${t('sharedDistance')}`,
        value: formatDistance(sum('distance'), distanceUnit, t),
        icon: <RouteRoundedIcon />,
      },
      {
        key: 'maxSpeed',
        label: t('reportMaximumSpeed'),
        value: maxSpeed > 0 ? formatSpeed(maxSpeed, speedUnit, t) : null,
        icon: <SpeedRoundedIcon />,
      },
      {
        key: 'engineHours',
        label: t('reportEngineHours'),
        value: engineHours > 0 ? formatNumericHours(engineHours, t) : null,
        icon: <TimerRoundedIcon />,
      },
      {
        key: 'spentFuel',
        label: t('reportSpentFuel'),
        value: spentFuel > 0 ? formatVolume(spentFuel, volumeUnit, t) : null,
        icon: <LocalGasStationRoundedIcon />,
      },
    ];
  }, [items, distanceUnit, speedUnit, volumeUnit, t]);

  const {
    sorted: sortedItems,
    sort,
    toggle: toggleSort,
  } = useReportSort('summary', items, (item, sortKey) =>
    sortKey === 'deviceId' ? vehicleName(devices, item.deviceId) : item[sortKey],
  );

  const formatValue = (item, key) => {
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return vehicleName(devices, value);
      case 'startTime':
        return formatTime(value, 'date');
      case 'startOdometer':
      case 'endOdometer':
      case 'distance':
        return formatDistance(value, distanceUnit, t);
      case 'averageSpeed':
      case 'maxSpeed':
        return value > 0 ? formatSpeed(value, speedUnit, t) : null;
      case 'engineHours':
      case 'startHours':
      case 'endHours':
        return value > 0 ? formatNumericHours(value, t) : null;
      case 'spentFuel':
        return value > 0 ? formatVolume(value, volumeUnit, t) : null;
      case 'fuelPer100':
        return value == null ? null : value.toFixed(1);
      case 'idlePercent':
        return value == null ? null : `${value}%`;
      default:
        return value;
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportSummary']}>
      <div className={classes.header}>
        <ReportFilter
          onShow={onShow}
          onExport={onExport}
          onSchedule={onSchedule}
          deviceType="multiple"
          loading={loading}
          formats={['xlsx']}
        >
          <div className={classes.filterItem}>
            <FormControl fullWidth>
              <InputLabel id="summary-report-page-shared-type-label">
                {t('reportSummaryView')}
              </InputLabel>
              <Select
                labelId="summary-report-page-shared-type-label"
                label={t('reportSummaryView')}
                value={daily}
                onChange={(e) =>
                  updateReportParams(searchParams, setSearchParams, 'daily', [
                    String(e.target.value),
                  ])
                }
              >
                <MenuItem value={false}>{t('reportSummaryTotal')}</MenuItem>
                <MenuItem value>{t('reportSummaryByDay')}</MenuItem>
              </Select>
            </FormControl>
          </div>
          <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
          {!daily && (
            <div className={classes.filterItem}>
              <FormControlLabel
                control={
                  <Switch checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                }
                label={t('reportComparePrevious')}
              />
            </div>
          )}
        </ReportFilter>
      </div>
      {!loading && <ReportKpis items={kpis} />}
      {!loading && days?.length > 1 && <DailyDistanceChart points={days} />}
      <DataTable variant="flush">
        <TableHead>
          <TableRow>
            <SortCell sortKey="deviceId" sort={sort} onSort={toggleSort}>
              {t('sharedDevice')}
            </SortCell>
            {columns.map((key) => (
              <SortCell
                key={key}
                sortKey={key}
                sort={sort}
                onSort={toggleSort}
                align={alignOf(key)}
              >
                {t(columnsMap.get(key))}
              </SortCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading && queried && !items.length && <ReportEmptyRow colSpan={columns.length + 1} />}
          {!loading ? (
            sortedItems.map((item) => (
              <TableRow key={`${item.deviceId}_${Date.parse(item.startTime)}`}>
                <TableCell>
                  {/* REP-07: the row's trips (its day in a daily summary). */}
                  <Link
                    component={RouterLink}
                    to={summaryTripsLink(item, daily)}
                    underline="hover"
                    aria-label={`${t('reportShowTrips')}: ${vehicleName(devices, item.deviceId)}`}
                  >
                    {vehicleName(devices, item.deviceId)}
                  </Link>
                </TableCell>
                {columns.map((key) => {
                  const change =
                    previous && COMPARED.includes(key)
                      ? delta(item[key], previous.get(item.deviceId)?.[key])
                      : null;
                  return (
                    <TableCell key={key} align={alignOf(key)}>
                      {formatValue(item, key)}
                      {change && (
                        <span
                          className={classes.delta}
                          aria-label={t('reportChangeFromPrevious').replace(
                            '{0}',
                            formatDelta(change),
                          )}
                        >
                          <bdi dir="ltr">{formatDelta(change)}</bdi>
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableShimmer columns={columns.length + 1} />
          )}
        </TableBody>
        {!loading && (
          <ReportTotalsRow
            numeric={NUMERIC_COLUMNS}
            leading={1}
            columns={columns}
            spec={TOTALS}
            items={items}
            format={formatValue}
          />
        )}
      </DataTable>
    </PageLayout>
  );
};

export default SummaryReportPage;

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
} from '@mui/material';
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
import { useCatch, useCatchCallback } from '../reactHelper';
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
];
const columnsMap = new Map(columnsArray);

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
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);

  const onShow = useCatchCallback(
    async ({ deviceIds, groupIds, from, to }) => {
      const query = new URLSearchParams({ from, to, daily });
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      groupIds.forEach((groupId) => query.append('groupId', groupId));
      setLoading(true);
      try {
        const response = await fetchOrThrow(`api/reports/summary?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        setItems(await response.json());
      } finally {
        setLoading(false);
        setQueried(true);
      }
    },
    [daily],
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
        </ReportFilter>
      </div>
      {!loading && <ReportKpis items={kpis} />}
      <DataTable variant="flush">
        <TableHead>
          <TableRow>
            <SortCell sortKey="deviceId" sort={sort} onSort={toggleSort}>
              {t('sharedDevice')}
            </SortCell>
            {columns.map((key) => (
              <SortCell key={key} sortKey={key} sort={sort} onSort={toggleSort}>
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
                {columns.map((key) => (
                  <TableCell key={key}>{formatValue(item, key)}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableShimmer columns={columns.length + 1} />
          )}
        </TableBody>
        {!loading && (
          <ReportTotalsRow
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

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { IconButton, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixedRounded';
import LocationSearchingIcon from '@mui/icons-material/LocationSearchingRounded';
import {
  formatAddress,
  formatDistance,
  formatVolume,
  formatTime,
  formatNumericHours,
} from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import ReportKpis from './components/ReportKpis';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import ResizeHandle from './components/ResizeHandle';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch, useCatchCallback } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapMarkers from '../map/MapMarkers';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import {
  ReportEmptyRow,
  ReportTotalsRow,
  SortCell,
  useReportSort,
} from './components/ReportTableParts';
import DataTable from '../common/components/table/DataTable';
import MapGeofence from '../map/MapGeofence';
import { mapIconKey } from '../map/core/preloadImages';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import { privateRows } from '../common/fleet/privacyData';
import { isPlaceField } from '../common/fleet/privacy';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';

const columnsArray = [
  ['startTime', 'reportStartTime'],
  ['startOdometer', 'positionOdometer'],
  ['address', 'positionAddress'],
  ['endTime', 'reportEndTime'],
  ['duration', 'reportDuration'],
  ['engineHours', 'reportEngineHours'],
  ['spentFuel', 'reportSpentFuel'],
];
const columnsMap = new Map(columnsArray);

// The totals row: times and fuel add up.
const TOTALS = { duration: 'sum', engineHours: 'sum', spentFuel: 'sum' };

const StopReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));

  const distanceUnit = useAttributePreference('distanceUnit');
  const volumeUnit = useAttributePreference('volumeUnit');
  const coordinateFormat = usePreference('coordinateFormat');

  const [columns, setColumns] = usePersistedState('stopColumns', [
    'startTime',
    'endTime',
    'startOdometer',
    'address',
  ]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [hiddenRows, setHiddenRows] = useState(0);

  const onShow = useCatchCallback(async ({ deviceIds, groupIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`api/reports/stops?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      // Places in hidden time (outside working hours, private periods) are taken out.
      const rows = await response.json();
      const result = await privateRows(rows, {
        deviceIds: [...deviceIds, ...rows.map((row) => row.deviceId)],
        from,
        to,
      });
      setItems(result.rows);
      setHiddenRows(result.hidden);
    } finally {
      setLoading(false);
      setQueried(true);
    }
  }, []);

  const onExport = useCatch(async () => {
    const sheets = new Map();
    items.forEach((item) => {
      // One sheet per vehicle, keyed by id: two vehicles with the same name stay apart.
      if (!sheets.has(item.deviceId)) {
        sheets.set(item.deviceId, { title: devices[item.deviceId].name, rows: [] });
      }
      const row = {};
      columns.forEach((key) => {
        const header = t(columnsMap.get(key));
        if (item.privacy && isPlaceField(key)) {
          row[header] = t('privacyHiddenShort');
        } else if (key === 'address') {
          row[header] = formatAddress(item, coordinateFormat);
        } else {
          row[header] = formatValue(item, key);
        }
      });
      sheets.get(item.deviceId).rows.push(row);
    });
    await exportExcel(t('reportStops'), 'stops.xlsx', sheets, theme);
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'stops';
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const kpis = useMemo(() => {
    if (!items.length) {
      return [];
    }
    const duration = items.reduce((total, item) => total + (item.duration || 0), 0);
    return [
      {
        key: 'count',
        label: t('reportStops'),
        value: items.length,
        icon: <PauseCircleRoundedIcon />,
      },
      {
        key: 'duration',
        label: `${t('sharedTotal')} · ${t('reportDuration')}`,
        value: formatNumericHours(duration, t),
        icon: <TimerRoundedIcon />,
      },
    ];
  }, [items, t]);

  const {
    sorted: sortedItems,
    sort,
    toggle: toggleSort,
  } = useReportSort('stops', items, (item, sortKey) =>
    sortKey === 'deviceId' ? devices[item.deviceId]?.name : item[sortKey],
  );

  const formatValue = (item, key) => {
    if (item.privacy && isPlaceField(key)) {
      return t('privacyHiddenShort');
    }
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return devices[value].name;
      case 'startTime':
      case 'endTime':
        return formatTime(value, 'minutes');
      case 'startOdometer':
        return formatDistance(value, distanceUnit, t);
      case 'duration':
        return formatNumericHours(value, t);
      case 'engineHours':
        return value > 0 ? formatNumericHours(value, t) : null;
      case 'spentFuel':
        return value > 0 ? formatVolume(value, volumeUnit, t) : null;
      case 'address':
        return (
          <AddressValue
            latitude={item.latitude}
            longitude={item.longitude}
            originalAddress={value}
          />
        );
      default:
        return value;
    }
  };

  const selectedMarker = selectedItem && {
    latitude: selectedItem.latitude,
    longitude: selectedItem.longitude,
    image: `${mapIconKey(devices[selectedItem.deviceId]?.category)}-neutral`,
    title: formatTime(selectedItem.startTime, 'seconds'),
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportStops']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                <MapMarkers markers={[selectedMarker]} showTitles />
              </MapView>
              <MapScale />
              <MapCamera latitude={selectedItem.latitude} longitude={selectedItem.longitude} />
            </div>
            <ResizeHandle />
          </>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter
              onShow={onShow}
              onExport={onExport}
              onSchedule={onSchedule}
              deviceType="multiple"
              loading={loading}
              formats={['xlsx']}
            >
              <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
            </ReportFilter>
          </div>
          {!loading && <ReportKpis items={kpis} />}
          <DataTable variant="flush">
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
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
              {!loading && queried && !items.length && (
                <ReportEmptyRow colSpan={columns.length + 2} />
              )}
              {!loading ? (
                sortedItems.map((item) => (
                  <TableRow key={item.positionId}>
                    <TableCell className={classes.columnAction} padding="none">
                      {selectedItem === item ? (
                        <IconButton
                          aria-label={t('a11yHideOnMap')}
                          size="small"
                          onClick={() => setSelectedItem(null)}
                        >
                          <GpsFixedIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton
                          aria-label={t('a11yShowOnMap')}
                          size="small"
                          disabled={Boolean(item.privacy)}
                          onClick={() => setSelectedItem(item)}
                        >
                          <LocationSearchingIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell>{devices[item.deviceId].name}</TableCell>
                    {columns.map((key) => (
                      <TableCell key={key}>{formatValue(item, key)}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + 2} startAction />
              )}
            </TableBody>
            {!loading && (
              <ReportTotalsRow
                leading={2}
                columns={columns}
                spec={TOTALS}
                items={items}
                format={formatValue}
              />
            )}
          </DataTable>
          {!loading && <PrivacyNote hidden={hiddenRows} kind="rows" padded />}
        </div>
      </div>
    </PageLayout>
  );
};

export default StopReportPage;

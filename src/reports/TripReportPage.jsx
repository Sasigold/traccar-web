import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { IconButton, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixedRounded';
import LocationSearchingIcon from '@mui/icons-material/LocationSearchingRounded';
import RouteIcon from '@mui/icons-material/RouteRounded';
import {
  formatAddress,
  formatDistance,
  formatSpeed,
  formatVolume,
  formatTime,
  formatNumericHours,
} from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SelectField from '../common/components/SelectField';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import ReportKpis from './components/ReportKpis';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import ResizeHandle from './components/ResizeHandle';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch, useCatchCallback, useAsyncTask } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import {
  ReportEmptyRow,
  ReportTotalsRow,
  SortCell,
  useReportSort,
} from './components/ReportTableParts';
import DataTable from '../common/components/table/DataTable';
import MapMarkers from '../map/MapMarkers';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';

const columnsArray = [
  ['startTime', 'reportStartTime'],
  ['startOdometer', 'reportStartOdometer'],
  ['startAddress', 'reportStartAddress'],
  ['endTime', 'reportEndTime'],
  ['endOdometer', 'reportEndOdometer'],
  ['endAddress', 'reportEndAddress'],
  ['distance', 'sharedDistance'],
  ['averageSpeed', 'reportAverageSpeed'],
  ['maxSpeed', 'reportMaximumSpeed'],
  ['duration', 'reportDuration'],
  ['spentFuel', 'reportSpentFuel'],
  ['driverName', 'sharedDriver'],
  ['business', 'sharedType'],
];
const columnsMap = new Map(columnsArray);

// The totals row: distances, times and fuel add up; speeds take the top or the time-weighted mean.
const TOTALS = {
  distance: 'sum',
  duration: 'sum',
  spentFuel: 'sum',
  maxSpeed: 'max',
  averageSpeed: 'avg:duration',
};

const TripReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));

  const distanceUnit = useAttributePreference('distanceUnit');
  const speedUnit = useAttributePreference('speedUnit');
  const volumeUnit = useAttributePreference('volumeUnit');
  const coordinateFormat = usePreference('coordinateFormat');

  const [columns, setColumns] = usePersistedState('tripColumns', [
    'startTime',
    'endTime',
    'distance',
    'averageSpeed',
  ]);
  const [tripType, setTripType] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(null);

  const filteredItems = items.filter(
    (item) => !tripType || item.business === (tripType === 'business'),
  );

  const markers = selectedItem && [
    {
      latitude: selectedItem.startLat,
      longitude: selectedItem.startLon,
      image: 'start-success',
    },
    {
      latitude: selectedItem.endLat,
      longitude: selectedItem.endLon,
      image: 'finish-error',
    },
  ];

  useAsyncTask(
    async ({ signal }) => {
      if (selectedItem) {
        const query = new URLSearchParams({
          deviceId: selectedItem.deviceId,
          from: selectedItem.startTime,
          to: selectedItem.endTime,
        });
        const response = await fetchOrThrow(`api/reports/route?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        setRoute(await response.json());
      } else {
        setRoute(null);
      }
    },
    [selectedItem],
  );

  const onShow = useCatchCallback(async ({ deviceIds, groupIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`api/reports/trips?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setItems(await response.json());
    } finally {
      setLoading(false);
      setQueried(true);
    }
  }, []);

  const onExport = useCatch(async () => {
    const sheets = new Map();
    filteredItems.forEach((item) => {
      // One sheet per vehicle, keyed by id: two vehicles with the same name stay apart.
      if (!sheets.has(item.deviceId)) {
        sheets.set(item.deviceId, { title: devices[item.deviceId].name, rows: [] });
      }
      const row = {};
      columns.forEach((key) => {
        const header = t(columnsMap.get(key));
        if (key === 'startAddress') {
          row[header] = formatAddress(
            {
              address: item.startAddress,
              latitude: item.startLat,
              longitude: item.startLon,
            },
            coordinateFormat,
          );
        } else if (key === 'endAddress') {
          row[header] = formatAddress(
            {
              address: item.endAddress,
              latitude: item.endLat,
              longitude: item.endLon,
            },
            coordinateFormat,
          );
        } else {
          row[header] = formatValue(item, key);
        }
      });
      sheets.get(item.deviceId).rows.push(row);
    });
    await exportExcel(t('reportTrips'), 'trips.xlsx', sheets, theme, {
      totals: [t('sharedDistance'), t('reportSpentFuel')],
    });
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'trips';
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const navigateToReplay = (item) => {
    navigate({
      pathname: '/replay',
      search: new URLSearchParams({
        from: item.startTime,
        to: item.endTime,
        deviceId: item.deviceId,
      }).toString(),
    });
  };

  const kpis = useMemo(() => {
    if (!filteredItems.length) {
      return [];
    }
    const sum = (key) => filteredItems.reduce((total, item) => total + (item[key] || 0), 0);
    const maxSpeed = Math.max(0, ...filteredItems.map((item) => item.maxSpeed || 0));
    return [
      {
        key: 'count',
        label: t('reportTrips'),
        value: filteredItems.length,
        icon: <PlayCircleRoundedIcon />,
      },
      {
        key: 'distance',
        label: `${t('sharedTotal')} · ${t('sharedDistance')}`,
        value: formatDistance(sum('distance'), distanceUnit, t),
        icon: <RouteIcon />,
      },
      {
        key: 'duration',
        label: `${t('sharedTotal')} · ${t('reportDuration')}`,
        value: formatNumericHours(sum('duration'), t),
        icon: <TimerRoundedIcon />,
      },
      {
        key: 'maxSpeed',
        label: t('reportMaximumSpeed'),
        value: maxSpeed > 0 ? formatSpeed(maxSpeed, speedUnit, t) : null,
        icon: <SpeedRoundedIcon />,
      },
    ];
  }, [filteredItems, distanceUnit, speedUnit, t]);

  const {
    sorted: sortedItems,
    sort,
    toggle: toggleSort,
  } = useReportSort('trips', filteredItems, (item, key) =>
    key === 'deviceId' ? devices[item.deviceId]?.name : item[key],
  );

  const formatValue = (item, key) => {
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return devices[value].name;
      case 'business':
        return t(value ? 'positionBusiness' : 'reportPrivate');
      case 'startTime':
      case 'endTime':
        return formatTime(value, 'minutes');
      case 'startOdometer':
      case 'endOdometer':
      case 'distance':
        return formatDistance(value, distanceUnit, t);
      case 'averageSpeed':
      case 'maxSpeed':
        return value > 0 ? formatSpeed(value, speedUnit, t) : null;
      case 'duration':
        return formatNumericHours(value, t);
      case 'spentFuel':
        return value > 0 ? formatVolume(value, volumeUnit, t) : null;
      case 'startAddress':
        return (
          <AddressValue
            latitude={item.startLat}
            longitude={item.startLon}
            originalAddress={value}
          />
        );
      case 'endAddress':
        return (
          <AddressValue latitude={item.endLat} longitude={item.endLon} originalAddress={value} />
        );
      default:
        return value;
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTrips']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                {route && (
                  <>
                    <MapRoutePath positions={route} />
                    <MapMarkers markers={markers} />
                    <MapCamera positions={route} />
                  </>
                )}
              </MapView>
              <MapScale />
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
              <div className={classes.filterItem}>
                <SelectField
                  fullWidth
                  label={t('reportTripTypeLabel')}
                  value={tripType}
                  data={[
                    { id: 'business', name: t('positionBusiness') },
                    { id: 'private', name: t('reportPrivate') },
                  ]}
                  onChange={(event) => {
                    setTripType(event.target.value);
                    setSelectedItem(null);
                  }}
                />
              </div>
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
              {!loading && queried && !filteredItems.length && (
                <ReportEmptyRow colSpan={columns.length + 2} />
              )}
              {!loading ? (
                sortedItems.map((item) => (
                  <TableRow key={item.startPositionId}>
                    <TableCell className={classes.columnAction} padding="none">
                      <div className={classes.columnActionContainer}>
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
                            onClick={() => setSelectedItem(item)}
                          >
                            <LocationSearchingIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          aria-label={t('reportReplay')}
                          size="small"
                          onClick={() => navigateToReplay(item)}
                        >
                          <RouteIcon fontSize="small" />
                        </IconButton>
                      </div>
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
                items={filteredItems}
                format={formatValue}
              />
            )}
          </DataTable>
        </div>
      </div>
    </PageLayout>
  );
};

export default TripReportPage;

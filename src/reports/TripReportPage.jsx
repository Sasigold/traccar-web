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
import { useCatch, useAsyncTask, useRunCallback } from '../reactHelper';
import { useFleetReady } from '../common/fleet/useFleet';
import { assignmentResolver, loadAssignments } from '../fleet/safetyData';
import { tripDriverKey } from '../common/fleet/checkin';
import useReportStyles from './common/useReportStyles';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import AddressValue, { AllAddressesButton } from '../common/components/AddressValue';
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
import { privateRows } from '../common/fleet/privacyData';
import { isPlaceField } from '../common/fleet/privacy';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';
import VehicleCell from './components/VehicleCell';
import { vehicleName, vehicleTitle } from './common/vehicle';
import useSelectedRow from './common/useSelectedRow';
import { litersPer100 } from './common/reportRules';
import { alignOf, NUMERIC_COLUMNS } from './common/numericColumns';

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
  ['litersPer100', 'reportLitersPer100'],
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

// The driver filter's choice for trips nobody is known to have driven (SAF-02).
const NO_DRIVER = '__none';

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
  const [driver, setDriver] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const selectedRowRef = useSelectedRow(selectedItem);
  const [hiddenRows, setHiddenRows] = useState(0);
  const [route, setRoute] = useState(null);

  // SAF-02: a trip without an identified driver may still have an assigned one (check-in or a
  // fixed assignment in the fleet database).
  const fleetReady = useFleetReady();
  const traccarDrivers = useSelector((state) => state.drivers.items);
  const [resolve, setResolve] = useState(null);
  useAsyncTask(async () => {
    if (!fleetReady) return;
    const byId = Object.fromEntries(Object.values(traccarDrivers).map((item) => [item.id, item]));
    const assignments = await loadAssignments().catch(() => []);
    setResolve(() => assignmentResolver(assignments, byId));
  }, [fleetReady, traccarDrivers]);
  const unassigned = (item) => !tripDriverKey(item, resolve);

  // REP-05: the drivers who drove in the result, to show one driver's trips.
  const driverOptions = useMemo(() => {
    const names = new Map();
    items.forEach((item) => {
      if (item.driverUniqueId) {
        names.set(item.driverUniqueId, item.driverName || item.driverUniqueId);
      }
    });
    const options = [...names]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return items.some((item) => !tripDriverKey(item, resolve))
      ? [...options, { id: NO_DRIVER, name: t('tripsWithoutDriver') }]
      : options;
  }, [items, resolve, t]);
  // A driver who is not in a new result stops filtering it.
  const activeDriver = driverOptions.some((option) => option.id === driver) ? driver : null;

  const filteredItems = items.filter(
    (item) =>
      (!tripType || item.business === (tripType === 'business')) &&
      (!activeDriver ||
        (activeDriver === NO_DRIVER ? unassigned(item) : item.driverUniqueId === activeDriver)),
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

  const onShow = useRunCallback(async ({ deviceIds, groupIds, from, to, signal }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`api/reports/trips?${query.toString()}`, {
        signal,
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
    filteredItems.forEach((item) => {
      // One sheet per vehicle, keyed by id: two vehicles with the same name stay apart.
      if (!sheets.has(item.deviceId)) {
        sheets.set(item.deviceId, { title: vehicleTitle(devices, item.deviceId), rows: [] });
      }
      const row = {};
      columns.forEach((key) => {
        const header = t(columnsMap.get(key));
        if (item.privacy && isPlaceField(key)) {
          row[header] = t('privacyHiddenShort');
        } else if (key === 'startAddress') {
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
    key === 'deviceId' ? vehicleName(devices, item.deviceId) : item[key],
  );

  const formatValue = (item, key) => {
    if (item.privacy && isPlaceField(key)) {
      return t('privacyHiddenShort');
    }
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return vehicleName(devices, value);
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
      case 'litersPer100': {
        // REP-14: consumption, when the device reports fuel.
        const rate = litersPer100(item.spentFuel, item.distance);
        return rate == null ? null : rate.toFixed(1);
      }
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
              {driverOptions.length > 0 && (
                <div className={classes.filterItem}>
                  <SelectField
                    fullWidth
                    label={t('sharedDriver')}
                    value={activeDriver}
                    data={driverOptions}
                    onChange={(event) => {
                      setDriver(event.target.value || null);
                      setSelectedItem(null);
                    }}
                  />
                </div>
              )}
              <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
              <AllAddressesButton
                className={classes.filterItem}
                points={[
                  ...(columns.includes('startAddress')
                    ? filteredItems
                        .filter((item) => !item.privacy)
                        .map((item) => ({
                          latitude: item.startLat,
                          longitude: item.startLon,
                          address: item.startAddress,
                        }))
                    : []),
                  ...(columns.includes('endAddress')
                    ? filteredItems
                        .filter((item) => !item.privacy)
                        .map((item) => ({
                          latitude: item.endLat,
                          longitude: item.endLon,
                          address: item.endAddress,
                        }))
                    : []),
                ]}
              />
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
              {!loading && queried && !filteredItems.length && (
                <ReportEmptyRow colSpan={columns.length + 2} />
              )}
              {!loading ? (
                sortedItems.map((item) => (
                  <TableRow
                    key={`${item.deviceId}-${item.startPositionId}-${item.startTime}`}
                    ref={selectedItem === item ? selectedRowRef : undefined}
                    className={selectedItem === item ? classes.selectedRow : undefined}
                  >
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
                            disabled={Boolean(item.privacy)}
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
                    <TableCell>
                      <VehicleCell deviceId={item.deviceId} />
                    </TableCell>
                    {columns.map((key) => (
                      <TableCell key={key} align={alignOf(key)}>
                        {formatValue(item, key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + 2} startAction />
              )}
            </TableBody>
            {!loading && (
              <ReportTotalsRow
                numeric={NUMERIC_COLUMNS}
                leading={2}
                columns={columns}
                spec={TOTALS}
                items={filteredItems}
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

export default TripReportPage;

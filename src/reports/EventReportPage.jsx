import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TableHead, TableRow, TableCell, TableBody, IconButton } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixedRounded';
import LocationSearchingIcon from '@mui/icons-material/LocationSearchingRounded';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { formatAddress, formatTime } from '../common/util/formatter';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { prefixString, unprefixString } from '../common/util/stringUtils';
import { useTranslation, useTranslationKeys } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import usePersistedState from '../common/util/usePersistedState';
import ColumnSelect from './components/ColumnSelect';
import ResizeHandle from './components/ResizeHandle';
import { useCatch, useCatchCallback, useAsyncTask } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import { ReportEmptyRow, SortCell, useReportSort } from './components/ReportTableParts';
import DataTable from '../common/components/table/DataTable';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import MapView from '../map/core/MapView';
import MapGeofence from '../map/MapGeofence';
import MapMarkers from '../map/MapMarkers';
import MapCamera from '../map/MapCamera';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import SelectField from '../common/components/SelectField';
import { privateRows } from '../common/fleet/privacyData';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import AddressValue from '../common/components/AddressValue';
import formatEventData from './common/formatEventData';
import { eventIconKey } from '../map/core/preloadImages';
import { deviceEquality } from '../common/util/deviceEquality';

const columnsArray = [
  ['eventTime', 'positionFixTime'],
  ['type', 'sharedType'],
  ['geofenceId', 'sharedGeofence'],
  ['maintenanceId', 'sharedMaintenance'],
  ['address', 'positionAddress'],
  ['attributes', 'commandData'],
];
const columnsMap = new Map(columnsArray);

// Positions per request when filling in event addresses.
const POSITIONS_CHUNK = 128;

const EventReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();

  const devices = useSelector(
    (state) => state.devices.items,
    deviceEquality(['id', 'name', 'uniqueId']),
  );
  const geofences = useSelector((state) => state.geofences.items);
  const maintenances = useSelector((state) => state.maintenances.items);

  const speedUnit = useAttributePreference('speedUnit');
  const coordinateFormat = usePreference('coordinateFormat');

  const [allEventTypes, setAllEventTypes] = useState([{ id: 'allEvents', label: 'eventAll' }]);

  const alarms = useTranslationKeys((it) => it.startsWith('alarm')).map((it) => ({
    key: unprefixString('alarm', it),
    name: t(it),
  }));

  const [columns, setColumns] = usePersistedState('eventColumns', [
    'eventTime',
    'type',
    'address',
    'attributes',
  ]);
  const eventTypes = useMemo(() => searchParams.getAll('eventType'), [searchParams]);
  const alarmTypes = useMemo(() => searchParams.getAll('alarmType'), [searchParams]);
  const [items, setItems] = useState([]);
  const [hiddenRows, setHiddenRows] = useState(0);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!eventTypes.length) {
      updateReportParams(searchParams, setSearchParams, 'eventType', ['allEvents']);
    }
  }, [searchParams, setSearchParams, eventTypes]);

  useEffect(() => {
    if (selectedItem?.positionId) {
      setPosition(positions[selectedItem.positionId] || null);
    } else {
      setPosition(null);
    }
  }, [selectedItem, positions]);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('api/notifications/types', { signal });
    const types = await response.json();
    setAllEventTypes((previous) => [
      ...previous,
      ...types.map((it) => ({ id: it.type, label: prefixString('event', it.type) })),
    ]);
  }, []);

  const onShow = useCatchCallback(
    async ({ deviceIds, groupIds, from, to }) => {
      const query = new URLSearchParams({ from, to });
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      groupIds.forEach((groupId) => query.append('groupId', groupId));
      eventTypes.forEach((it) => query.append('type', it));
      if (eventTypes[0] !== 'allEvents' && eventTypes.includes('alarm')) {
        alarmTypes.forEach((it) => query.append('alarm', it));
      }
      setSelectedItem(null);
      setPosition(null);
      setLoading(true);
      try {
        const response = await fetchOrThrow(`api/reports/events?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        // Events in hidden time keep their time and type but lose their place.
        const result = await privateRows(await response.json(), {
          deviceIds,
          from,
          to,
          times: ['eventTime'],
        });
        const events = result.rows.map((event) =>
          event.privacy ? { ...event, positionId: null } : event,
        );
        setItems(events);
        setHiddenRows(result.hidden);
        const positionIds = Array.from(
          new Set(events.map((event) => event.positionId).filter((id) => id)),
        );
        // Every event's position (address, map), fetched in chunks the server accepts; the
        // list shows as soon as the events are in, positions fill in after.
        setPositions({});
        setLoading(false);
        setQueried(true);
        const positionsMap = {};
        for (let start = 0; start < positionIds.length; start += POSITIONS_CHUNK) {
          const positionsQuery = new URLSearchParams();
          positionIds
            .slice(start, start + POSITIONS_CHUNK)
            .forEach((id) => positionsQuery.append('id', id));

          const positionsResponse = await fetchOrThrow(
            `api/positions?${positionsQuery.toString()}`,
          );

          const positionsArray = await positionsResponse.json();
          positionsArray.forEach((p) => (positionsMap[p.id] = p));
          setPositions({ ...positionsMap });
        }
      } finally {
        setLoading(false);
        setQueried(true);
      }
    },
    [eventTypes, alarmTypes],
  );

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
        if (key === 'attributes' && item.type === 'media') {
          row[header] = item.attributes.file;
        } else if (key === 'address') {
          const position = positions[item.positionId];
          row[header] = position ? formatAddress(position, coordinateFormat) : '';
        } else {
          row[header] = formatValue(item, key);
        }
      });
      sheets.get(item.deviceId).rows.push(row);
    });
    await exportExcel(t('reportEvents'), 'events.xlsx', sheets, theme);
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'events';
    if (eventTypes[0] !== 'allEvents') {
      report.attributes.types = eventTypes.join(',');
    }
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const {
    sorted: sortedItems,
    sort,
    toggle: toggleSort,
  } = useReportSort('events', items, (item, sortKey) => {
    if (sortKey === 'deviceId') {
      return devices[item.deviceId]?.name;
    }
    if (sortKey === 'type') {
      return t(prefixString('event', item.type));
    }
    return item[sortKey];
  });

  const formatValue = (item, key) => {
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return devices[value].name;
      case 'eventTime':
        return formatTime(value, 'seconds');
      case 'type':
        return t(prefixString('event', value));
      case 'geofenceId':
        if (value > 0) {
          const geofence = geofences[value];
          return geofence && geofence.name;
        }
        return null;
      case 'maintenanceId':
        if (value > 0) {
          const maintenance = maintenances[value];
          return maintenance && maintenance.name;
        }
        return null;
      case 'address': {
        const position = positions[item.positionId];
        if (position) {
          return (
            <AddressValue
              latitude={position.latitude}
              longitude={position.longitude}
              originalAddress={position.address}
            />
          );
        }
        return '';
      }
      case 'attributes':
        return formatEventData(item, {
          deviceUniqueId: devices[item.deviceId]?.uniqueId,
          speedUnit,
          t,
        });
      default:
        return value;
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportEvents']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                {position && selectedItem && (
                  <MapMarkers
                    markers={[
                      {
                        latitude: position.latitude,
                        longitude: position.longitude,
                        image: eventIconKey(selectedItem.type),
                        title: formatTime(position.fixTime, 'seconds'),
                      },
                    ]}
                    showTitles
                  />
                )}
              </MapView>
              <MapScale />
              {position && (
                <MapCamera latitude={position.latitude} longitude={position.longitude} />
              )}
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
                  multiple
                  singleLine
                  data={allEventTypes}
                  value={eventTypes}
                  allValue="allEvents"
                  titleGetter={(it) => t(it.label)}
                  onChange={(e) =>
                    updateReportParams(searchParams, setSearchParams, 'eventType', e.target.value)
                  }
                  label={t('reportEventTypes')}
                  fullWidth
                />
              </div>
              {eventTypes[0] !== 'allEvents' && eventTypes.includes('alarm') && (
                <div className={classes.filterItem}>
                  <SelectField
                    multiple
                    singleLine
                    value={alarmTypes}
                    onChange={(e) =>
                      updateReportParams(searchParams, setSearchParams, 'alarmType', e.target.value)
                    }
                    data={alarms}
                    keyGetter={(it) => it.key}
                    label={t('sharedAlarms')}
                    fullWidth
                  />
                </div>
              )}
              <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
            </ReportFilter>
          </div>
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
                  <TableRow key={item.id}>
                    <TableCell className={classes.columnAction} padding="none">
                      {(item.positionId &&
                        (selectedItem === item ? (
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
                        ))) ||
                        ''}
                    </TableCell>
                    <TableCell>{devices[item.deviceId].name}</TableCell>
                    {columns.map((key) => (
                      <TableCell key={key}>{formatValue(item, key)}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + 2} />
              )}
            </TableBody>
          </DataTable>
          {!loading && <PrivacyNote hidden={hiddenRows} kind="rows" padded />}
        </div>
      </div>
    </PageLayout>
  );
};

export default EventReportPage;

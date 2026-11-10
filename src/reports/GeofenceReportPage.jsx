import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { formatNumericHours, formatTime } from '../common/util/formatter';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch, useRunCallback } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import { privateRows } from '../common/fleet/privacyData';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import SelectField from '../common/components/SelectField';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';
import VehicleCell from './components/VehicleCell';
import { vehicleTitle } from './common/vehicle';
import { visitDuration } from './common/reportRules';

const columnsArray = [
  ['geofenceId', 'sharedGeofence'],
  ['startTime', 'reportStartTime'],
  ['endTime', 'reportEndTime'],
  ['duration', 'reportDuration'],
];
const columnsMap = new Map(columnsArray);

const GeofenceReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const theme = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();
  const geofenceIds = useMemo(() => searchParams.getAll('geofenceId').map(Number), [searchParams]);

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));
  const geofences = useSelector((state) => state.geofences.items);

  // REP-14: how long, by default.
  const [columns, setColumns] = usePersistedState('geofenceColumns', [
    'geofenceId',
    'startTime',
    'endTime',
    'duration',
  ]);
  const [items, setItems] = useState([]);
  const [hiddenRows, setHiddenRows] = useState(0);
  const [loading, setLoading] = useState(false);

  const onShow = useRunCallback(
    async ({ deviceIds, groupIds, from, to, signal }) => {
      const query = new URLSearchParams({ from, to });
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      groupIds.forEach((groupId) => query.append('groupId', groupId));
      geofenceIds.forEach((geofenceId) => query.append('geofenceId', geofenceId));
      setLoading(true);
      try {
        const response = await fetchOrThrow(`api/reports/geofences?${query.toString()}`, {
          signal,
          headers: { Accept: 'application/json' },
        });
        // A visit in hidden time would tell where the vehicle was: it is left out.
        const rows = await response.json();
        const result = await privateRows(rows, {
          deviceIds: [...deviceIds, ...rows.map((row) => row.deviceId)],
          from,
          to,
        });
        setItems(result.rows.filter((row) => !row.privacy));
        setHiddenRows(result.hidden);
      } finally {
        setLoading(false);
      }
    },
    [geofenceIds],
  );

  const onExport = useCatch(async () => {
    const sheets = new Map();
    items.forEach((item) => {
      // One sheet per vehicle, keyed by id: two vehicles with the same name stay apart.
      if (!sheets.has(item.deviceId)) {
        sheets.set(item.deviceId, { title: vehicleTitle(devices, item.deviceId), rows: [] });
      }
      const row = {};
      columns.forEach((key) => {
        const header = t(columnsMap.get(key));
        row[header] = formatValue(item, key);
      });
      sheets.get(item.deviceId).rows.push(row);
    });
    await exportExcel(t('sharedGeofences'), 'geofences.xlsx', sheets, theme);
  });

  const formatValue = (item, key) => {
    switch (key) {
      case 'geofenceId':
        return geofences[item.geofenceId]?.name || item.geofenceId;
      case 'startTime':
        return formatTime(item[key], 'minutes');
      case 'endTime':
        // REP-14: a visit without an exit yet is still inside, not "NaN".
        return item.endTime ? formatTime(item.endTime, 'minutes') : t('reportStillInside');
      case 'duration': {
        const { open, duration } = visitDuration(item);
        if (duration == null) return null;
        const text = formatNumericHours(duration, t);
        return open ? `${text} (${t('reportSoFar')})` : text;
      }
      default:
        return item[key];
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'sharedGeofences']}>
      <div className={classes.header}>
        <ReportFilter
          onShow={onShow}
          onExport={onExport}
          deviceType="multiple"
          loading={loading}
          formats={['xlsx']}
        >
          <div className={classes.filterItem}>
            <SelectField
              label={t('sharedGeofences')}
              value={geofenceIds}
              onChange={(e) =>
                updateReportParams(searchParams, setSearchParams, 'geofenceId', e.target.value)
              }
              endpoint="api/geofences"
              multiple
              singleLine
              fullWidth
            />
          </div>
          <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
        </ReportFilter>
      </div>
      <DataTable variant="flush">
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedDevice')}</TableCell>
            {columns.map((key) => (
              <TableCell key={key}>{t(columnsMap.get(key))}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? (
            items.map((item) => (
              <TableRow
                key={`${item.deviceId}_${item.geofenceId}_${item.startTime}_${item.endTime}`}
              >
                <TableCell>
                  <VehicleCell deviceId={item.deviceId} />
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
      </DataTable>
      {!loading && <PrivacyNote hidden={hiddenRows} kind="rows" padded />}
    </PageLayout>
  );
};

export default GeofenceReportPage;

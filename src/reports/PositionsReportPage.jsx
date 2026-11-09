import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconButton, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixedRounded';
import LocationSearchingIcon from '@mui/icons-material/LocationSearchingRounded';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import PositionValue from '../common/components/PositionValue';
import ColumnSelect from './components/ColumnSelect';
import ResizeHandle from './components/ResizeHandle';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { useCatch, useCatchCallback } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositionMarkers from '../map/MapPositionMarkers';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import { ReportEmptyRow, ReportLimitNote } from './components/ReportTableParts';
import DataTable from '../common/components/table/DataTable';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import { useRestriction } from '../common/util/permissions';
import CollectionActions from '../settings/components/CollectionActions';
import { privatePositions } from '../common/fleet/privacyData';
import PrivacyNote from '../common/components/PrivacyNote';
import fetchOrThrow from '../common/util/fetchOrThrow';
import SelectField from '../common/components/SelectField';

// Rows drawn on screen; the export has them all, and the page says when rows are left out.
const SHOWN_LIMIT = 4000;

const PositionsReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();

  const positionAttributes = usePositionAttributes(t);

  const readonly = useRestriction('readonly');

  const [available, setAvailable] = useState([]);
  const [columns, setColumns] = useState(['fixTime', 'latitude', 'longitude', 'speed', 'address']);
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(null);
  const geofenceId = searchParams.has('geofenceId')
    ? parseInt(searchParams.get('geofenceId'))
    : null;
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const selectedRef = useRef();

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedItem]);

  const onMapPointClick = useCallback(
    (positionId) => {
      setSelectedItem(items.find((it) => it.id === positionId));
    },
    [items, setSelectedItem],
  );

  const onShow = useCatchCallback(
    async ({ deviceIds, from, to }) => {
      const query = new URLSearchParams({ from, to });
      if (geofenceId) {
        query.append('geofenceId', geofenceId);
      }
      deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
      setLoading(true);
      try {
        const response = await fetchOrThrow(`api/positions?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        // Locations in hidden time (outside working hours, private periods) are left out.
        const result = await privatePositions(await response.json(), {
          deviceIds,
          from,
          to,
          view: 'report',
        });
        const data = result.positions;
        setHidden(result);
        const keySet = new Set();
        const keyList = [];
        data.forEach((position) => {
          Object.keys(position).forEach((it) => keySet.add(it));
          Object.keys(position.attributes).forEach((it) => keySet.add(it));
        });
        ['id', 'deviceId', 'outdated', 'network', 'attributes'].forEach((key) =>
          keySet.delete(key),
        );
        Object.keys(positionAttributes).forEach((key) => {
          if (keySet.has(key)) {
            keyList.push(key);
            keySet.delete(key);
          }
        });
        setAvailable(
          [...keyList, ...keySet].map((key) => [key, positionAttributes[key]?.name || key]),
        );
        setItems(data);
      } finally {
        setLoading(false);
        setQueried(true);
      }
    },
    [geofenceId, positionAttributes],
  );

  const onExport = useCatch(async ({ deviceIds, from, to, format }) => {
    const query = new URLSearchParams({ from, to });
    if (geofenceId) {
      query.append('geofenceId', geofenceId);
    }
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    window.location.assign(`api/positions/${format}?${query.toString()}`);
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'route';
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportPositions']}>
      <div className={classes.container}>
        {selectedItem && (
          <>
            <div className={classes.containerMap}>
              <MapView>
                <MapGeofence />
                {[...new Set(items.map((it) => it.deviceId))].map((deviceId) => {
                  const positions = items.filter((position) => position.deviceId === deviceId);
                  return (
                    <Fragment key={deviceId}>
                      <MapRoutePath positions={positions} />
                      <MapRoutePoints positions={positions} onClick={onMapPointClick} />
                    </Fragment>
                  );
                })}
                <MapPositionMarkers positions={[selectedItem]} titleField="fixTime" />
              </MapView>
              <MapScale />
              <MapCamera positions={items} />
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
              deviceType="single"
              loading={loading}
              formats={['csv', 'gpx', 'kml', 'kmz']}
            >
              <div className={classes.filterItem}>
                <SelectField
                  value={geofenceId}
                  onChange={(e) => {
                    const values = e.target.value ? [e.target.value] : [];
                    updateReportParams(searchParams, setSearchParams, 'geofenceId', values);
                  }}
                  endpoint="api/geofences"
                  label={t('sharedGeofence')}
                  fullWidth
                />
              </div>
              <ColumnSelect
                columns={columns}
                setColumns={setColumns}
                columnsArray={available}
                rawValues
                disabled={!items.length}
              />
            </ReportFilter>
          </div>
          <DataTable variant="flush">
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                {columns.map((key) => (
                  <TableCell key={key}>{positionAttributes[key]?.name || key}</TableCell>
                ))}
                <TableCell className={classes.columnAction} />
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && queried && !items.length && (
                <ReportEmptyRow colSpan={columns.length + 2} />
              )}
              {!loading ? (
                items.slice(0, SHOWN_LIMIT).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={classes.columnAction} padding="none">
                      {selectedItem === item ? (
                        <IconButton
                          aria-label={t('a11yHideOnMap')}
                          size="small"
                          onClick={() => setSelectedItem(null)}
                          ref={selectedRef}
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
                    </TableCell>
                    {columns.map((key) => (
                      <TableCell key={key}>
                        <PositionValue
                          position={item}
                          property={item.hasOwnProperty(key) ? key : null}
                          attribute={item.hasOwnProperty(key) ? null : key}
                        />
                      </TableCell>
                    ))}
                    <TableCell className={classes.actionCellPadding}>
                      <CollectionActions
                        itemId={item.id}
                        endpoint="positions"
                        readonly={readonly}
                        onReload={() => {
                          setItems(items.filter((position) => position.id !== item.id));
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={columns.length + 1} startAction />
              )}
            </TableBody>
          </DataTable>
          {!loading && (
            <PrivacyNote hidden={hidden?.hidden} distance={hidden?.hiddenDistance} padded />
          )}
          {!loading && <ReportLimitNote shown={SHOWN_LIMIT} total={items.length} />}
        </div>
      </div>
    </PageLayout>
  );
};

export default PositionsReportPage;

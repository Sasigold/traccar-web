import { useCallback, useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  FormControlLabel,
  Switch,
  Typography,
  Link,
  Button,
  Checkbox,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ImportDialog from '../fleet/components/ImportDialog';
import BulkVehicleBar from './components/BulkVehicleBar';
import { importEntity } from '../common/fleet/bulkImport';
import { digitsOf } from '../common/util/israeliFields';
import { makeStyles } from 'tss-react/mui';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import { useTheme } from '@mui/material/styles';
import { useLivePositions } from '../common/fleet/usePrivacy';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import AddFab from './components/AddFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import { formatAddress, formatStatus, formatTime } from '../common/util/formatter';
import { useDeviceReadonly, useManager } from '../common/util/permissions';
import { usePreference } from '../common/util/preferences';
import useSettingsStyles from './common/useSettingsStyles';
import DeviceUsersValue from './components/DeviceUsersValue';
import usePersistedState from '../common/util/usePersistedState';
import fetchOrThrow from '../common/util/fetchOrThrow';
import AddressValue from '../common/components/AddressValue';
import exportExcel from '../common/util/exportExcel';
import { statusColor } from '../common/theme/surfaces';
import DeviceTile from '../common/components/brand/DeviceTile';
import { entityExpiryStatus, vehicleExpiryFields } from '../common/fleet/fleetFields';
import ExpiryBadge from '../fleet/components/ExpiryBadge';
import ColumnsMenu from '../common/components/table/ColumnsMenu';

// ADM-25: the vehicle (name and plate), status, group and validity by default; the rest on demand.
const DEFAULT_COLUMNS = ['group', 'validity'];

const useStyles = makeStyles()((theme) => ({
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    fontWeight: 600,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  // Plates and identifiers never wrap in the middle ("12-345-" / "67").
  mono: {
    fontFamily: theme.tokens.font.mono,
    fontSize: '0.8125rem',
    whiteSpace: 'nowrap',
  },
  plate: {
    display: 'block',
    fontFamily: theme.tokens.font.mono,
    fontSize: '0.75rem',
    fontWeight: 400,
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
}));

const DevicesPage = () => {
  const { classes: settingsClasses } = useSettingsStyles();
  const { classes } = useStyles();
  const [columns, setColumns] = usePersistedState('deviceColumns', DEFAULT_COLUMNS);
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const groups = useSelector((state) => state.groups.items);

  const manager = useManager();
  const deviceReadonly = useDeviceReadonly();
  const coordinateFormat = usePreference('coordinateFormat');

  const positions = useLivePositions();

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAll, setShowAll] = usePersistedState('showAllDevices', false);
  const [hasMore, setHasMore] = useState(true);
  // ADM-13: import from a spreadsheet, and actions on the ticked rows.
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const storeDevices = useSelector((state) => state.devices.items);
  const existing = useMemo(() => {
    const all = Object.values(storeDevices);
    return {
      identifiers: new Set(all.map((device) => String(device.uniqueId).toLowerCase())),
      plates: new Set(
        all.map((device) => digitsOf(device.attributes?.plateNumber)).filter(Boolean),
      ),
    };
  }, [storeDevices]);
  const groupsByName = useMemo(
    () =>
      Object.fromEntries(
        Object.values(groups).map((group) => [group.name.toLowerCase(), group.id]),
      ),
    [groups],
  );
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = items.filter((item) => selected.has(item.id));

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ all: showAll, limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/devices?${query.toString()}`, { signal });
      const data = await response.json();
      setItems((previous) => (offset ? [...previous, ...data] : data));
      setHasMore(data.length >= pageSize);
    },
    [searchKeyword, showAll],
  );

  const sentinelRef = useScrollToLoad(() => loadItems(items.length));

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setItems([]);
      await loadItems(0, signal);
    },
    [reloadKey, loadItems],
  );

  // The list loads 50 at a time while scrolling; the export always takes every matching device.
  const handleExport = async (only) => {
    let allItems = only;
    if (!allItems) {
      const query = new URLSearchParams({ all: showAll });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/devices?${query.toString()}`);
      allItems = await response.json();
    }
    const data = allItems.map((item) => ({
      [t('sharedName')]: item.name,
      [t('fleetPlateNumber')]: item.attributes?.plateNumber,
      [t('deviceIdentifier')]: item.uniqueId,
      [t('groupParent')]: item.groupId ? groups[item.groupId]?.name : null,
      [t('sharedPhone')]: item.phone,
      [t('deviceModel')]: item.model,
      [t('deviceContact')]: item.contact,
      [t('deviceServiceExpiry')]: formatTime(item.expirationTime, 'date'),
      [t('deviceStatus')]: formatStatus(item.status, t),
      [t('deviceLastUpdate')]: formatTime(item.lastUpdate, 'minutes'),
      [t('positionAddress')]: positions[item.id]
        ? formatAddress(positions[item.id], coordinateFormat)
        : '',
    }));
    const sheets = new Map();
    sheets.set(t('deviceTitle'), data);
    await exportExcel(t('deviceTitle'), 'devices.xlsx', sheets, theme);
  };

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkRoundedIcon fontSize="small" />,
    handler: (deviceId) => navigate(`/settings/device/${deviceId}/connections`),
  };

  const optionalColumns = [
    { key: 'group', label: t('groupParent') },
    { key: 'validity', label: t('fleetValidity') },
    { key: 'identifier', label: t('deviceIdentifier') },
    { key: 'phone', label: t('sharedPhone') },
    { key: 'model', label: t('deviceModel') },
    { key: 'contact', label: t('deviceContact') },
    { key: 'serviceExpiry', label: t('deviceServiceExpiry') },
    { key: 'address', label: t('positionAddress') },
    ...(manager ? [{ key: 'users', label: t('settingsUsers') }] : []),
  ];
  const on = (key) => columns.includes(key) && optionalColumns.some((c) => c.key === key);
  const columnCount =
    3 + optionalColumns.filter((column) => on(column.key)).length + (deviceReadonly ? 0 : 1);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'deviceTitle']}
      description={t('settingsDevicesDescription')}
    >
      <DataTable
        toolbar={
          <>
            <TableToolbar
              search={{ value: searchKeyword, onChange: setSearchKeyword }}
              count={items.length}
              addPath="/fleet/vehicle/new"
              addDisabled={deviceReadonly}
              exportHandler={() => handleExport()}
              actions={
                <>
                  {!deviceReadonly && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UploadFileRoundedIcon />}
                      onClick={() => setImporting(true)}
                    >
                      {t('importFromExcel')}
                    </Button>
                  )}
                  <ColumnsMenu columns={optionalColumns} shown={columns} onChange={setColumns} />
                  {manager && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showAll}
                          onChange={(e) => setShowAll(e.target.checked)}
                          size="small"
                        />
                      }
                      label={t('notificationAlways')}
                    />
                  )}
                </>
              }
            />
            {chosen.length > 0 && (
              <BulkVehicleBar
                devices={chosen}
                onClear={() => setSelected(new Set())}
                onExport={() => handleExport(chosen)}
                onDone={() => {
                  setSelected(new Set());
                  reload();
                }}
              />
            )}
          </>
        }
        empty={!hasMore && items.length === 0}
        emptyState={{
          icon: <DnsRoundedIcon />,
          title: t(searchKeyword ? 'tableNoMatches' : 'deviceRegisterFirst'),
          description: searchKeyword ? undefined : t('settingsDevicesDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            {!deviceReadonly && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={items.length > 0 && chosen.length === items.length}
                  indeterminate={chosen.length > 0 && chosen.length < items.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(items.map((item) => item.id)) : new Set(),
                    )
                  }
                  slotProps={{ input: { 'aria-label': t('bulkSelectAll') } }}
                />
              </TableCell>
            )}
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            {optionalColumns
              .filter((column) => on(column.key))
              .map((column) => (
                <TableCell key={column.key}>{column.label}</TableCell>
              ))}
            <TableCell className={settingsClasses.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const color = statusColor(theme, item.status);
            const validity = entityExpiryStatus(item, vehicleExpiryFields);
            return (
              <TableRow key={item.id} hover selected={selected.has(item.id)}>
                {!deviceReadonly && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      slotProps={{
                        input: { 'aria-label': t('bulkSelectRow').replace('{0}', item.name) },
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <span className={classes.name}>
                    <DeviceTile category={item.category} status={item.status} size={32} />
                    <span>
                      <Link component={RouterLink} to={`/fleet/vehicle/${item.id}`}>
                        {item.name}
                      </Link>
                      {item.attributes?.plateNumber && (
                        <bdi className={classes.plate} dir="ltr">
                          {item.attributes.plateNumber}
                        </bdi>
                      )}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className={classes.status}>
                    <span className={classes.dot} style={{ backgroundColor: color }} />
                    {formatStatus(item.status, t)}
                    {item.lastUpdate && (
                      <Typography variant="caption" className={classes.muted}>
                        · {formatTime(item.lastUpdate, 'minutes')}
                      </Typography>
                    )}
                  </span>
                </TableCell>
                {on('group') && (
                  <TableCell>{item.groupId ? groups[item.groupId]?.name : null}</TableCell>
                )}
                {on('validity') && (
                  <TableCell>{validity !== 'none' && <ExpiryBadge status={validity} />}</TableCell>
                )}
                {on('identifier') && (
                  <TableCell className={classes.mono}>
                    <bdi dir="ltr">{item.uniqueId}</bdi>
                  </TableCell>
                )}
                {on('phone') && (
                  <TableCell>
                    <bdi dir="ltr">{item.phone}</bdi>
                  </TableCell>
                )}
                {on('model') && <TableCell>{item.model}</TableCell>}
                {on('contact') && <TableCell>{item.contact}</TableCell>}
                {on('serviceExpiry') && (
                  <TableCell>{formatTime(item.expirationTime, 'date')}</TableCell>
                )}
                {on('address') && (
                  <TableCell>
                    {positions[item.id] && (
                      <AddressValue
                        latitude={positions[item.id].latitude}
                        longitude={positions[item.id].longitude}
                        originalAddress={positions[item.id]?.address}
                      />
                    )}
                  </TableCell>
                )}
                {on('users') && (
                  <TableCell>
                    <DeviceUsersValue deviceId={item.id} />
                  </TableCell>
                )}
                <TableCell className={settingsClasses.columnAction} padding="none">
                  <CollectionActions
                    itemId={item.id}
                    itemName={item.name}
                    editPath="/settings/device"
                    endpoint="devices"
                    onReload={reload}
                    customActions={[actionConnections]}
                    readonly={deviceReadonly}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {hasMore && (
            <TableShimmer
              ref={items.length > 0 ? sentinelRef : null}
              columns={columnCount}
              endAction
            />
          )}
        </TableBody>
      </DataTable>
      <AddFab editPath="/fleet/vehicle/new" disabled={deviceReadonly} />
      {importing && (
        <ImportDialog
          kind="vehicles"
          existing={existing}
          save={async (values) => {
            await fetchOrThrow('api/devices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(importEntity('vehicles', values, { groups: groupsByName })),
            });
          }}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}
    </PageLayout>
  );
};

export default DevicesPage;

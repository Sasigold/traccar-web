import { useCallback, useReducer, useState } from 'react';
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
} from '@mui/material';
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
}));

const DevicesPage = () => {
  const { classes: settingsClasses } = useSettingsStyles();
  const { classes } = useStyles();
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
  const handleExport = async () => {
    const query = new URLSearchParams({ all: showAll });
    if (searchKeyword) {
      query.append('keyword', searchKeyword);
    }
    const response = await fetchOrThrow(`api/devices?${query.toString()}`);
    const allItems = await response.json();
    const data = allItems.map((item) => ({
      [t('sharedName')]: item.name,
      [t('fleetPlateNumber')]: item.attributes?.plateNumber,
      [t('deviceIdentifier')]: item.uniqueId,
      [t('groupParent')]: item.groupId ? groups[item.groupId]?.name : null,
      [t('sharedPhone')]: item.phone,
      [t('deviceModel')]: item.model,
      [t('deviceContact')]: item.contact,
      [t('userExpirationTime')]: formatTime(item.expirationTime, 'date'),
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

  const columnCount = manager ? 12 : 11;

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'deviceTitle']}
      description={t('settingsDevicesDescription')}
    >
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: searchKeyword, onChange: setSearchKeyword }}
            count={items.length}
            addPath="/settings/device"
            addDisabled={deviceReadonly}
            exportHandler={handleExport}
            actions={
              manager && (
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
              )
            }
          />
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
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('fleetPlateNumber')}</TableCell>
            <TableCell>{t('fleetValidity')}</TableCell>
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>{t('groupParent')}</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('deviceModel')}</TableCell>
            <TableCell>{t('deviceContact')}</TableCell>
            <TableCell>{t('userExpirationTime')}</TableCell>
            <TableCell>{t('positionAddress')}</TableCell>
            {manager && <TableCell>{t('settingsUsers')}</TableCell>}
            <TableCell className={settingsClasses.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const color = statusColor(theme, item.status);
            const validity = entityExpiryStatus(item, vehicleExpiryFields);
            return (
              <TableRow key={item.id} hover>
                <TableCell>
                  <span className={classes.name}>
                    <DeviceTile category={item.category} status={item.status} size={32} />
                    <Link component={RouterLink} to={`/fleet/vehicle/${item.id}`}>
                      {item.name}
                    </Link>
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
                <TableCell className={classes.mono}>
                  <span dir="ltr">{item.attributes?.plateNumber}</span>
                </TableCell>
                <TableCell>{validity !== 'none' && <ExpiryBadge status={validity} />}</TableCell>
                <TableCell className={classes.mono}>
                  <bdi dir="ltr">{item.uniqueId}</bdi>
                </TableCell>
                <TableCell>{item.groupId ? groups[item.groupId]?.name : null}</TableCell>
                <TableCell>{item.phone}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell>{item.contact}</TableCell>
                <TableCell>{formatTime(item.expirationTime, 'date')}</TableCell>
                <TableCell>
                  {positions[item.id] && (
                    <AddressValue
                      latitude={positions[item.id].latitude}
                      longitude={positions[item.id].longitude}
                      originalAddress={positions[item.id]?.address}
                    />
                  )}
                </TableCell>
                {manager && (
                  <TableCell>
                    <DeviceUsersValue deviceId={item.id} />
                  </TableCell>
                )}
                <TableCell className={settingsClasses.columnAction} padding="none">
                  <CollectionActions
                    itemId={item.id}
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
      <AddFab editPath="/settings/device" disabled={deviceReadonly} />
    </PageLayout>
  );
};

export default DevicesPage;

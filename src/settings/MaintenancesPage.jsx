import { useCallback, useReducer, useState } from 'react';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { Chip, TableRow, TableCell, TableHead, TableBody } from '@mui/material';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import useAttributeUnits from '../common/util/useAttributeUnits';
import { formatAttributeNumber, attributeUnitString } from '../common/util/attributeUnits';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import AddFab from './components/AddFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import usePersistedState from '../common/util/usePersistedState';
import { loadMaintenanceLinks, useMaintenanceRows } from '../fleet/maintenance';
import MaintenanceStatusTable from '../fleet/components/MaintenanceStatusTable';
import MaintenanceCalendar from '../fleet/components/MaintenanceCalendar';
import BrandLoader from '../common/components/brand/BrandLoader';

const views = ['status', 'calendar', 'definitions'];
const viewLabel = {
  status: 'fleetMaintenanceStatusView',
  calendar: 'fleetMaintenanceCalendarView',
  definitions: 'fleetMaintenanceDefinitions',
};

const MaintenacesPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const positionAttributes = usePositionAttributes(t);

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const units = useAttributeUnits();

  const [view, setView] = usePersistedState('maintenanceView', 'status');
  const devices = useSelector((state) => state.devices.items);
  const deviceIds = Object.keys(devices).join(',');
  const [statusReloadKey, reloadStatus] = useReducer((k) => k + 1, 0);
  const [links, setLinks] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void statusReloadKey;
      if (view !== 'status' && view !== 'calendar') {
        return;
      }
      setLinks(null);
      const ids = deviceIds ? deviceIds.split(',') : [];
      setLinks(await loadMaintenanceLinks(ids, signal));
    },
    [view, deviceIds, statusReloadKey],
  );

  const statusRows = useMaintenanceRows(links?.links);
  const keyword = searchKeyword.trim().toLowerCase();
  const filteredStatusRows = (statusRows || []).filter(
    (row) =>
      !keyword ||
      [row.maintenance.name, row.device?.name].some((value) =>
        value?.toLowerCase().includes(keyword),
      ),
  );

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(viewLabel[key])}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => setView(key)}
    />
  ));

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/maintenance?${query.toString()}`, { signal });
      const data = await response.json();
      setItems((previous) => (offset ? [...previous, ...data] : data));
      setHasMore(data.length >= pageSize);
    },
    [searchKeyword],
  );

  const sentinelRef = useScrollToLoad(() => loadItems(items.length));

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      // ADM-28: the rows stay (dimmed) while the list reloads, instead of flashing empty.
      setRefreshing(true);
      try {
        await loadItems(0, signal);
      } finally {
        setRefreshing(false);
      }
    },
    [reloadKey, loadItems],
  );

  const convertAttribute = (key, start, value) => {
    const attribute = positionAttributes[key];
    if (key.endsWith('Time')) {
      if (start) {
        return dayjs(value).locale('en').format('YYYY-MM-DD');
      }
      return `${value / 86400000} ${t('sharedDays')}`;
    }
    const formatted = formatAttributeNumber(value, attribute?.dataType, units);
    const unit = attributeUnitString(attribute?.dataType, units, t);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  if (view === 'calendar') {
    return (
      <PageLayout
        menu={<SettingsMenu />}
        breadcrumbs={['fleetTitle', 'sharedMaintenance']}
        description={t('fleetMaintenanceCalendarDescription')}
      >
        <DataTable
          toolbar={
            <TableToolbar
              search={{ value: searchKeyword, onChange: setSearchKeyword }}
              count={statusRows ? filteredStatusRows.length : undefined}
              filters={viewChips}
              addPath="/settings/maintenance"
            />
          }
          empty={statusRows != null && filteredStatusRows.length === 0}
          emptyState={{
            title: t(keyword ? 'tableNoMatches' : 'fleetMaintenanceNone'),
            description: keyword ? undefined : t('fleetMaintenanceNoneDescription'),
          }}
          body={
            statusRows == null ? <BrandLoader /> : <MaintenanceCalendar rows={filteredStatusRows} />
          }
        />
        <AddFab editPath="/settings/maintenance" />
      </PageLayout>
    );
  }

  if (view === 'status') {
    return (
      <PageLayout
        menu={<SettingsMenu />}
        breadcrumbs={['fleetTitle', 'sharedMaintenance']}
        description={t('fleetMaintenanceStatusDescription')}
      >
        <DataTable
          toolbar={
            <TableToolbar
              search={{ value: searchKeyword, onChange: setSearchKeyword }}
              count={statusRows ? filteredStatusRows.length : undefined}
              filters={viewChips}
              addPath="/settings/maintenance"
            />
          }
          empty={statusRows != null && filteredStatusRows.length === 0}
          emptyState={{
            title: t(keyword ? 'tableNoMatches' : 'fleetMaintenanceNone'),
            description: keyword ? undefined : t('fleetMaintenanceNoneDescription'),
          }}
        >
          {statusRows == null ? (
            <TableBody>
              <TableShimmer columns={6} />
            </TableBody>
          ) : (
            <MaintenanceStatusTable
              bare
              showVehicle
              rows={filteredStatusRows}
              shared={links.shared}
              onDone={reloadStatus}
            />
          )}
        </DataTable>
        <AddFab editPath="/settings/maintenance" />
      </PageLayout>
    );
  }

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['fleetTitle', 'sharedMaintenance']}>
      <DataTable
        refreshing={refreshing && items.length > 0}
        toolbar={
          <TableToolbar
            search={{ value: searchKeyword, onChange: setSearchKeyword }}
            filters={viewChips}
            addPath="/settings/maintenance"
          />
        }
        empty={!hasMore && items.length === 0}
        emptyState={{
          title: t(searchKeyword ? 'tableNoMatches' : 'tableEmptyTitle'),
          description: searchKeyword ? undefined : t('tableEmptyDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('maintenanceStart')}</TableCell>
            <TableCell>{t('maintenancePeriod')}</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.type}</TableCell>
              <TableCell>{convertAttribute(item.type, true, item.start)}</TableCell>
              <TableCell>{convertAttribute(item.type, false, item.period)}</TableCell>
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  itemName={item.name}
                  editPath="/settings/maintenance"
                  endpoint="maintenance"
                  onReload={reload}
                />
              </TableCell>
            </TableRow>
          ))}
          {hasMore && (
            <TableShimmer ref={items.length > 0 ? sentinelRef : null} columns={5} endAction />
          )}
        </TableBody>
      </DataTable>
      <AddFab editPath="/settings/maintenance" />
    </PageLayout>
  );
};

export default MaintenacesPage;

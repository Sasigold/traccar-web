import { useCallback, useReducer, useState } from 'react';
import { TableRow, TableCell, TableHead, TableBody } from '@mui/material';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
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

const CalendarsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/calendars?${query.toString()}`, { signal });
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

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'sharedCalendars']}>
      <DataTable
        refreshing={refreshing && items.length > 0}
        toolbar={
          <TableToolbar
            search={{ value: searchKeyword, onChange: setSearchKeyword }}
            addPath="/settings/calendar"
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
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  itemName={item.name}
                  editPath="/settings/calendar"
                  endpoint="calendars"
                  onReload={reload}
                />
              </TableCell>
            </TableRow>
          ))}
          {hasMore && (
            <TableShimmer ref={items.length > 0 ? sentinelRef : null} columns={2} endAction />
          )}
        </TableBody>
      </DataTable>
      <AddFab editPath="/settings/calendar" />
    </PageLayout>
  );
};

export default CalendarsPage;

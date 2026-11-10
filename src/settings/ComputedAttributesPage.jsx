import { useCallback, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Chip, TableRow, TableCell, TableHead, TableBody, Tooltip } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator } from '../common/util/permissions';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import AddFab from './components/AddFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { managedComputed } from '../admin/sensors';

const ComputedAttributesPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const administrator = useAdministrator();
  const devices = useSelector((state) => state.devices.items);

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/attributes/computed?${query.toString()}`, {
        signal,
      });
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
      setItems([]);
      await loadItems(0, signal);
    },
    [reloadKey, loadItems],
  );

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'sharedComputedAttributes']}>
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: searchKeyword, onChange: setSearchKeyword }}
            addPath="/settings/attribute"
            addDisabled={!administrator}
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
            <TableCell>{t('sharedDescription')}</TableCell>
            <TableCell>{t('sharedAttribute')}</TableCell>
            <TableCell>{t('sharedExpression')}</TableCell>
            <TableCell>{t('sharedType')}</TableCell>
            {administrator && <TableCell className={classes.columnAction} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            // ADM-25: rows the sensors setup made are read here and changed only there;
            // deleting one would quietly break the vehicle's ignition or inputs.
            const managed = managedComputed(item.description);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  {managed ? managed.label : item.description}
                  {managed && (
                    <Tooltip title={t('computedManagedHint')}>
                      <Chip
                        size="small"
                        icon={<LockRoundedIcon />}
                        label={t('computedManaged').replace(
                          '{0}',
                          devices[managed.deviceId]?.name || `#${managed.deviceId}`,
                        )}
                        sx={{ marginInlineStart: 1 }}
                      />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{item.attribute}</TableCell>
                <TableCell>
                  <bdi dir="ltr">{item.expression}</bdi>
                </TableCell>
                <TableCell>{item.type}</TableCell>
                {administrator && (
                  <TableCell className={classes.columnAction} padding="none">
                    {!managed && (
                      <CollectionActions
                        itemId={item.id}
                        itemName={item.description}
                        editPath="/settings/attribute"
                        endpoint="attributes/computed"
                        onReload={reload}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {hasMore && (
            <TableShimmer
              ref={items.length > 0 ? sentinelRef : null}
              columns={administrator ? 5 : 4}
              endAction={administrator}
            />
          )}
        </TableBody>
      </DataTable>
      <AddFab editPath="/settings/attribute" disabled={!administrator} />
    </PageLayout>
  );
};

export default ComputedAttributesPage;

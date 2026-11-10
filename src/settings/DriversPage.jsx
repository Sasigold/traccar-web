import { useCallback, useMemo, useReducer, useState } from 'react';
import { Button, Chip, TableRow, TableCell, TableHead, TableBody } from '@mui/material';
import { useSelector } from 'react-redux';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ImportDialog from '../fleet/components/ImportDialog';
import { importEntity } from '../common/fleet/bulkImport';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import AddFab from './components/AddFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import { makeStyles } from 'tss-react/mui';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { expiryStatus } from '../common/fleet/fleetFields';
import ExpiryBadge from '../fleet/components/ExpiryBadge';
import { useRestriction } from '../common/util/permissions';
import NewDriverChip from '../fleet/components/NewDriverChip';

const useStyles = makeStyles()((theme) => ({
  expiry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    whiteSpace: 'nowrap',
  },
}));

const licenseFilters = ['all', 'attention'];
const licenseFilterLabel = { all: 'fleetFilterAll', attention: 'fleetFilterAttention' };

const DriversPage = () => {
  const { classes: settingsClasses } = useSettingsStyles();
  const { classes } = useStyles();
  const t = useTranslation();
  // ADM-03: a viewer reaches this list through the fleet permissions; it stays read only.
  const readonly = useRestriction('readonly');

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // ADM-13: drivers from a spreadsheet.
  const [importing, setImporting] = useState(false);
  const storeDrivers = useSelector((state) => state.drivers.items);
  const existing = useMemo(
    () => ({
      identifiers: new Set(
        Object.values(storeDrivers).map((driver) => String(driver.uniqueId).toLowerCase()),
      ),
    }),
    [storeDrivers],
  );
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [licenseFilter, setLicenseFilter] = useState('all');

  const visible =
    licenseFilter === 'all'
      ? items
      : items.filter((item) =>
          ['expired', 'expiring'].includes(expiryStatus(item.attributes?.licenseExpiry)),
        );

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`api/drivers?${query.toString()}`, { signal });
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
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['fleetTitle', 'sharedDrivers']}>
      <DataTable
        refreshing={refreshing && items.length > 0}
        toolbar={
          <TableToolbar
            search={{ value: searchKeyword, onChange: setSearchKeyword }}
            addPath="/settings/driver"
            actions={
              !readonly && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UploadFileRoundedIcon />}
                  onClick={() => setImporting(true)}
                >
                  {t('importFromExcel')}
                </Button>
              )
            }
            filters={licenseFilters.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(licenseFilterLabel[key])}
                color={licenseFilter === key ? 'primary' : 'default'}
                variant={licenseFilter === key ? 'filled' : 'outlined'}
                onClick={() => setLicenseFilter(key)}
              />
            ))}
          />
        }
        empty={!hasMore && visible.length === 0}
        emptyState={{
          title: t(searchKeyword ? 'tableNoMatches' : 'tableEmptyTitle'),
          description: searchKeyword ? undefined : t('tableEmptyDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('fleetLicenseClasses')}</TableCell>
            <TableCell>{t('fleetLicenseExpiry')}</TableCell>
            <TableCell>{t('fleetDriverStatus')}</TableCell>
            <TableCell className={settingsClasses.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className={classes.expiry}>
                  {item.name}
                  <NewDriverChip issued={item.attributes?.licenseIssued} />
                </span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{item.uniqueId}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{item.attributes?.phone}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{(item.attributes?.licenseClasses || []).join(', ')}</span>
              </TableCell>
              <TableCell>
                {item.attributes?.licenseExpiry && (
                  <span className={classes.expiry}>
                    {formatTime(item.attributes.licenseExpiry, 'date')}
                    <ExpiryBadge date={item.attributes.licenseExpiry} />
                  </span>
                )}
              </TableCell>
              <TableCell>
                {item.attributes?.driverStatus &&
                  t(
                    `fleetDriverStatus${item.attributes.driverStatus.replace(/^\w/, (c) => c.toUpperCase())}`,
                  )}
              </TableCell>
              <TableCell className={settingsClasses.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  itemName={item.name}
                  editPath="/settings/driver"
                  endpoint="drivers"
                  onReload={reload}
                  readonly={readonly}
                />
              </TableCell>
            </TableRow>
          ))}
          {hasMore && (
            <TableShimmer ref={items.length > 0 ? sentinelRef : null} columns={7} endAction />
          )}
        </TableBody>
      </DataTable>
      <AddFab editPath="/settings/driver" />
      {importing && (
        <ImportDialog
          kind="drivers"
          existing={existing}
          save={async (values) => {
            await fetchOrThrow('api/drivers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(importEntity('drivers', values)),
            });
          }}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}
    </PageLayout>
  );
};

export default DriversPage;

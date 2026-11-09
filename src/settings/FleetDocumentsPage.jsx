import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import { useAsyncTask } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetError, useFleetLabel, useFleetStatus } from '../common/fleet/useFleet';
import SettingsMenu from './components/SettingsMenu';
import { ExpiryChip } from './components/FleetDocumentsSection';
import { formatTime } from '../common/util/formatter';

const useStyles = makeStyles()(() => ({
  row: {
    cursor: 'pointer',
  },
}));

const filters = ['all', 'expiring', 'expired'];

// Every vehicle / driver document with an expiry date, soonest first.
const FleetDocumentsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const label = useFleetLabel();

  const status = useFleetStatus();
  const error = useFleetError();

  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useAsyncTask(async () => {
    if (status !== 'ready') {
      return;
    }
    const client = getFleetClient();
    const rows = unwrap(
      await client.from('documents_expiring').select('*').order('expires_at', { ascending: true }),
    );
    setItems(rows || []);
  }, [status]);

  const filtered = useMemo(() => {
    if (!items) {
      return [];
    }
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.expiry_status !== filter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [item.plate_number, item.driver_name, item.title, item.file_name, label(item)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, search, filter, label]);

  const openEntity = (item) => {
    if (item.entity === 'vehicle' && item.traccar_device_id) {
      navigate(`/settings/device/${item.traccar_device_id}`);
    } else if (item.entity === 'driver' && item.traccar_driver_id) {
      navigate(`/settings/driver/${item.traccar_driver_id}`);
    }
  };

  const filterLabel = {
    all: 'fleetFilterAll',
    expiring: 'fleetFilterExpiring',
    expired: 'fleetFilterExpired',
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'fleetDocumentsPage']}
      description={t('fleetDocumentsPageDescription')}
    >
      {status === 'error' && (
        <Alert severity="warning" sx={{ mx: 3, mb: 2 }}>
          {t('fleetConnectionError').replace('{0}', error || '')}
        </Alert>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={items ? filtered.length : undefined}
            filters={filters.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(filterLabel[key])}
                color={filter === key ? 'primary' : 'default'}
                variant={filter === key ? 'filled' : 'outlined'}
                onClick={() => setFilter(key)}
              />
            ))}
          />
        }
        empty={items != null && filtered.length === 0}
        emptyState={{
          title: t(search || filter !== 'all' ? 'tableNoMatches' : 'fleetNoDocuments'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetEntity')}</TableCell>
            <TableCell>{t('fleetDocumentType')}</TableCell>
            <TableCell>{t('fleetDocumentTitle')}</TableCell>
            <TableCell>{t('fleetExpiresAt')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {items == null && status !== 'error' && <TableShimmer columns={5} />}
          {filtered.map((item) => (
            <TableRow key={item.id} hover className={classes.row} onClick={() => openEntity(item)}>
              <TableCell>
                {item.entity === 'vehicle'
                  ? `${t('sharedDevice')}: ${item.plate_number || ''}`
                  : `${t('sharedDriver')}: ${item.driver_name || ''}`}
              </TableCell>
              <TableCell>{label(item)}</TableCell>
              <TableCell>{item.title || item.file_name}</TableCell>
              <TableCell>{formatTime(item.expires_at, 'date')}</TableCell>
              <TableCell>
                <ExpiryChip expiresAt={item.expires_at} reminderDays={item.reminder_days} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default FleetDocumentsPage;

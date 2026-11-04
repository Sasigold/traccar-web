import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useAsyncTask, useCatch } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator } from '../common/util/permissions';
import PageLayout from '../common/components/PageLayout';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from './components/SettingsMenu';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';

const ProtocolsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();
  const admin = useAdministrator();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const transports = {
    DISABLED: t('sharedDisabled'),
    TCP: 'TCP',
    UDP: 'UDP',
    ALL: t('sharedAll'),
  };

  useAsyncTask(async ({ signal }) => {
    try {
      const response = await fetchOrThrow('api/protocols', { signal });
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = items.filter(
    (item) => item.protocol.includes(keyword.toLowerCase()) || String(item.port).includes(keyword),
  );

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const response = await fetchOrThrow(`api/protocols/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const updated = await response.json();
      setItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  });

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsProtocols']}>
      <DataTable
        toolbar={
          <TableToolbar search={{ value: keyword, onChange: setKeyword }} count={items.length} />
        }
        empty={!loading && filtered.length === 0}
        emptyState={{ title: t('tableNoMatches') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('positionProtocol')}</TableCell>
            <TableCell>{t('commandPort')}</TableCell>
            <TableCell>{t('settingsTransport')}</TableCell>
            {admin && <TableCell className={classes.columnAction} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.protocol}</TableCell>
              <TableCell>{item.port}</TableCell>
              <TableCell>{transports[item.transport]}</TableCell>
              {admin && (
                <TableCell className={classes.columnAction} padding="none">
                  <Tooltip title={t('sharedEdit')}>
                    <IconButton
                      size="small"
                      aria-label={t('sharedEdit')}
                      onClick={() => setEditing(item)}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
          {loading && <TableShimmer columns={admin ? 4 : 3} endAction={admin} />}
        </TableBody>
      </DataTable>
      {admin && editing && (
        <Dialog open onClose={() => !saving && setEditing(null)} fullWidth maxWidth="xs">
          <DialogTitle>{editing.protocol}</DialogTitle>
          <DialogContent className={classes.details}>
            <TextField
              margin="dense"
              label={t('commandPort')}
              type="number"
              value={editing.port}
              onChange={(event) => setEditing({ ...editing, port: Number(event.target.value) })}
            />
            <TextField
              select
              label={t('settingsTransport')}
              value={editing.transport}
              onChange={(event) => setEditing({ ...editing, transport: event.target.value })}
            >
              {Object.entries(transports).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button disabled={saving} onClick={() => setEditing(null)}>
              {t('sharedCancel')}
            </Button>
            <Button variant="contained" loading={saving} onClick={handleSave}>
              {t('sharedSave')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageLayout>
  );
};

export default ProtocolsPage;

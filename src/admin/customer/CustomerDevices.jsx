import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import FormSection from '../../settings/components/FormSection';
import EmptyState from '../../common/components/table/EmptyState';
import StateChip from '../components/StateChip';
import { assignDevices, saveRegistry } from '../adminApi';

const useStyles = makeStyles()((theme) => ({
  table: {
    '& .MuiTableCell-root': {
      paddingInline: theme.spacing(1),
    },
  },
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  scroll: {
    overflowX: 'auto',
  },
}));

const statusLabel = (status, t) =>
  t(`deviceStatus${(status || 'unknown').replace(/^\w/, (c) => c.toUpperCase())}`);

const CustomerDevices = ({ customer, devices, directory, editable }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);

  const deviceById = useMemo(
    () => new Map((devices || []).map((device) => [device.id, device])),
    [devices],
  );
  const rows = directory.registry
    .filter((row) => row.customer_id === customer.id)
    .map((row) => ({ row, device: deviceById.get(row.traccar_device_id) }))
    .filter((item) => item.device)
    .sort((a, b) => a.device.name.localeCompare(b.device.name));

  const candidates = (devices || [])
    .filter((device) => directory.deviceOwner.get(device.id)?.customer_id !== customer.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const ownerName = (device) => {
    const owner = directory.deviceOwner.get(device.id)?.customer_id;
    return owner ? directory.customerById.get(owner)?.name : null;
  };

  const handleAdd = useCatch(async () => {
    await assignDevices(
      picked.map((device) => device.id),
      customer.id,
    );
    setAdding(false);
    setPicked([]);
    directory.reload();
  });

  const handleRemove = useCatch(async (deviceId) => {
    await assignDevices([deviceId], null);
    directory.reload();
  });

  const handleBillable = useCatch(async (row, billable) => {
    await saveRegistry({ traccar_device_id: row.traccar_device_id, billable });
    directory.reload();
  });

  return (
    <FormSection
      icon={<DnsRoundedIcon />}
      title={t('adminCustomerDevices').replace('{0}', rows.length)}
      description={t('adminCustomerDevicesHelp')}
      actions={
        editable && (
          <Button
            variant="outlined"
            startIcon={<AddLinkRoundedIcon />}
            onClick={() => setAdding(true)}
          >
            {t('adminAssignDevices')}
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact icon={<DnsRoundedIcon />} title={t('adminNoDevicesForCustomer')} />
      ) : (
        <div className={classes.scroll}>
          <ResponsiveTable size="small" className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDevice')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell>{t('adminSimNumber')}</TableCell>
                <TableCell>{t('adminBillableShort')}</TableCell>
                <TableCell padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ row, device }) => (
                <TableRow key={device.id} hover>
                  <TableCell>
                    <span className={classes.name}>{device.name}</span>
                    <Typography
                      variant="caption"
                      className={classes.sub}
                      dir="ltr"
                      style={{ textAlign: 'start' }}
                    >
                      {device.uniqueId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StateChip
                      state={device.status || 'unknown'}
                      label={statusLabel(device.status, t)}
                    />
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{device.phone || ''}</span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={row.billable !== false}
                      disabled={!editable}
                      onChange={(event) => handleBillable(row, event.target.checked)}
                      slotProps={{ input: { 'aria-label': t('adminBillable') } }}
                    />
                  </TableCell>
                  <TableCell padding="none" style={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={t('adminDeviceSetup')}>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/device/${device.id}`)}
                        aria-label={t('adminDeviceSetup')}
                      >
                        <TuneRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {editable && (
                      <Tooltip title={t('adminUnassign')}>
                        <IconButton
                          size="small"
                          onClick={() => handleRemove(device.id)}
                          aria-label={t('adminUnassign')}
                        >
                          <LinkOffRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </div>
      )}
      {adding && (
        <Dialog open onClose={() => setAdding(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('adminAssignDevices')}</DialogTitle>
          <DialogContent style={{ paddingTop: 8 }}>
            <Autocomplete
              multiple
              options={candidates}
              value={picked}
              onChange={(_, value) => setPicked(value)}
              getOptionLabel={(device) => `${device.name} · ${device.uniqueId}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={({ key, ...props }, device) => (
                <li key={key} {...props}>
                  <span>
                    <span className={classes.name}>{device.name}</span>
                    <Typography variant="caption" className={classes.sub}>
                      <span dir="ltr">{device.uniqueId}</span>
                      {` · ${ownerName(device) || t('adminNoCustomer')}`}
                    </Typography>
                  </span>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label={t('adminDevices')} autoFocus />
              )}
            />
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {t('adminAssignDevicesHelp')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" onClick={() => setAdding(false)}>
              {t('sharedCancel')}
            </Button>
            <Button variant="contained" disabled={!picked.length} onClick={handleAdd}>
              {t('adminAssign')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </FormSection>
  );
};

export default CustomerDevices;

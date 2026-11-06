import { useMemo, useReducer, useState } from 'react';
import {
  Button,
  Chip,
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
import { makeStyles } from 'tss-react/mui';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RvHookupRoundedIcon from '@mui/icons-material/RvHookupRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import FleetNotice from './components/FleetNotice';
import { camel, cleanPayload, toNumber, useFleetVehicles } from './stage5Data';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  action: {
    width: '1%',
  },
}));

const KINDS = ['trailer', 'equipment'];
const kindKey = (kind) => `fleetAssetKind${camel(kind)}`;

const emptyAsset = {
  asset_kind: 'trailer',
  plate_number: '',
  serial_number: '',
  make: '',
  model: '',
  year: '',
  attached_vehicle_id: '',
  notes: '',
};
const assetKeys = ['asset_kind', 'plate_number', 'serial_number', 'make', 'model', 'notes'];

const AssetDialog = ({ asset, vehicles, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(asset);

  const save = useCatch(async () => {
    const payload = {
      ...cleanPayload(form, assetKeys),
      year: toNumber(form.year),
      attached_vehicle_id: form.attached_vehicle_id || null,
    };
    const client = getFleetClient();
    if (form.id) {
      unwrap(await client.from('vehicles').update(payload).eq('id', form.id));
    } else {
      unwrap(await client.from('vehicles').insert({ ...payload, org_id: profile.org_id }));
    }
    onSaved();
  });

  const field = (key, labelKey, props = {}) => (
    <TextField
      label={t(labelKey)}
      value={form[key] ?? ''}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      {...props}
    />
  );
  const ltr = { slotProps: { htmlInput: { dir: 'ltr' } } };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(form.id ? 'fleetAssetEdit' : 'fleetAssetAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            select
            label={t('sharedType')}
            value={form.asset_kind}
            onChange={(event) => setForm({ ...form, asset_kind: event.target.value })}
          >
            {KINDS.map((kind) => (
              <MenuItem key={kind} value={kind}>
                {t(kindKey(kind))}
              </MenuItem>
            ))}
          </TextField>
          {field('plate_number', 'fleetAssetIdentifier', { required: true, ...ltr })}
          {field('serial_number', 'fleetAssetSerial', ltr)}
          {field('year', 'fleetModelYear', { type: 'number', ...ltr })}
          {field('make', 'fleetMake')}
          {field('model', 'fleetVehicleModel')}
          <TextField
            select
            className={classes.wide}
            label={t('fleetAssetAttached')}
            value={form.attached_vehicle_id ?? ''}
            onChange={(event) => setForm({ ...form, attached_vehicle_id: event.target.value })}
          >
            <MenuItem value="">—</MenuItem>
            {vehicles.map((vehicle) => (
              <MenuItem key={vehicle.id} value={vehicle.id}>
                {vehicle.plate_number}
              </MenuItem>
            ))}
          </TextField>
          {field('notes', 'fleetNotes', { multiline: true, minRows: 2, className: classes.wide })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!form.plate_number.trim()}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Roadmap stage 5 (4.8): trailers and equipment without a GPS device, attached to a vehicle.
const EquipmentPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canRead = useFleetPermission('vehicles.read');
  const canWrite = useFleetPermission('vehicles.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const rows = useFleetVehicles(canRead, reloadKey);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [editing, setEditing] = useState(null);

  const vehicles = useMemo(
    () => (rows || []).filter((row) => (row.asset_kind || 'vehicle') === 'vehicle'),
    [rows],
  );
  const plateOf = useMemo(
    () => Object.fromEntries((rows || []).map((row) => [row.id, row.plate_number])),
    [rows],
  );

  const assets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (rows || []).filter(
      (row) =>
        KINDS.includes(row.asset_kind) &&
        (kind === 'all' || row.asset_kind === kind) &&
        (!keyword ||
          [row.plate_number, row.serial_number, row.make, plateOf[row.attached_vehicle_id]].some(
            (value) => value?.toLowerCase().includes(keyword),
          )),
    );
  }, [rows, search, kind, plateOf]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetEquipmentPage']}
      description={t('fleetEquipmentPageDescription')}
    >
      <FleetNotice permission="vehicles.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={assets.length}
            filters={['all', ...KINDS].map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(key === 'all' ? 'fleetFilterAll' : kindKey(key))}
                color={kind === key ? 'primary' : 'default'}
                variant={kind === key ? 'filled' : 'outlined'}
                onClick={() => setKind(key)}
              />
            ))}
            actions={
              canWrite && (
                <Button variant="contained" size="small" onClick={() => setEditing(emptyAsset)}>
                  {t('fleetAssetAdd')}
                </Button>
              )
            }
          />
        }
        empty={canRead && rows && assets.length === 0}
        emptyState={{ icon: <RvHookupRoundedIcon />, title: t('fleetEquipmentNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetAssetIdentifier')}</TableCell>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('fleetMake')}</TableCell>
            <TableCell>{t('fleetAssetSerial')}</TableCell>
            <TableCell>{t('fleetAssetAttached')}</TableCell>
            {canWrite && <TableCell className={classes.action} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {canRead && !rows ? (
            <TableShimmer columns={canWrite ? 6 : 5} />
          ) : (
            assets.map((asset) => (
              <TableRow key={asset.id} hover>
                <TableCell>
                  <span dir="ltr">{asset.plate_number}</span>
                </TableCell>
                <TableCell>{t(kindKey(asset.asset_kind))}</TableCell>
                <TableCell>{[asset.make, asset.model].filter(Boolean).join(' ')}</TableCell>
                <TableCell>
                  <span dir="ltr">{asset.serial_number}</span>
                </TableCell>
                <TableCell>
                  <span dir="ltr">{plateOf[asset.attached_vehicle_id] || ''}</span>
                </TableCell>
                {canWrite && (
                  <TableCell className={classes.action}>
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedEdit')}
                        onClick={() =>
                          setEditing({
                            ...emptyAsset,
                            ...asset,
                            attached_vehicle_id: asset.attached_vehicle_id || '',
                          })
                        }
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </DataTable>
      {editing && (
        <AssetDialog
          asset={editing}
          vehicles={vehicles.filter((vehicle) => vehicle.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default EquipmentPage;

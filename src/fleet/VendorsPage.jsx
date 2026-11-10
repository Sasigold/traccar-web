import { useMemo, useReducer, useState } from 'react';
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
import { makeStyles } from 'tss-react/mui';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { DateField } from '../common/components/pickers';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import FleetNotice from './components/FleetNotice';
import { useVendors } from './fleetData';
import ValidatedField from '../common/components/ValidatedField';
import { keepOnBackdrop } from '../common/util/formDialog';
import WazeButton from '../common/components/WazeButton';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  action: {
    width: '1%',
  },
}));

export const vendorTypes = [
  'garage',
  'tires',
  'glass',
  'towing',
  'insurance',
  'leasing',
  'fuel',
  'other',
];
export const vendorTypeKey = (type) =>
  `fleetVendorType${type.replace(/^\w/, (c) => c.toUpperCase())}`;

const emptyVendor = {
  name: '',
  type: 'garage',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  licensed: null,
  license_number: '',
  license_valid_until: '',
};

// Garages, tire shops, insurers and the other suppliers work orders and expenses point to.
export const VendorDialog = ({ vendor, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(vendor);

  const save = useCatch(async () => {
    const client = getFleetClient();
    const { id, ...values } = form;
    const payload = Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key in emptyVendor || key === 'active')
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]),
    );
    const saved = id
      ? unwrap(await client.from('vendors').update(payload).eq('id', id).select('*').single())
      : unwrap(
          await client
            .from('vendors')
            .insert({ ...payload, org_id: profile.org_id })
            .select('*')
            .single(),
        );
    onSaved(saved);
  });

  const field = (key, labelKey, props = {}) => (
    <TextField
      label={t(labelKey)}
      value={form[key] || ''}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      {...props}
    />
  );

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t(form.id ? 'fleetVendorEdit' : 'fleetVendorAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {field('name', 'sharedName')}
          <TextField
            select
            label={t('sharedType')}
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            {vendorTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {t(vendorTypeKey(type))}
              </MenuItem>
            ))}
          </TextField>
          {form.type === 'garage' && (
            <>
              <TextField
                select
                label={t('safetyGarageLicensed')}
                value={form.licensed == null ? '' : String(form.licensed)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    licensed: event.target.value === '' ? null : event.target.value === 'true',
                  })
                }
              >
                <MenuItem value="">{t('safetyGarageUnknown')}</MenuItem>
                <MenuItem value="true">{t('sharedYes')}</MenuItem>
                <MenuItem value="false">{t('sharedNo')}</MenuItem>
              </TextField>
              {form.licensed && (
                <>
                  {field('license_number', 'safetyGarageLicenseNumber', {
                    slotProps: { htmlInput: { dir: 'ltr' } },
                  })}
                  <DateField
                    label={t('safetyGarageLicenseUntil')}
                    value={form.license_valid_until || ''}
                    onChange={(event) =>
                      setForm({ ...form, license_valid_until: event.target.value })
                    }
                  />
                </>
              )}
            </>
          )}
          {field('contact_name', 'fleetVendorContact')}
          <ValidatedField
            kind="phone"
            label={t('sharedPhone')}
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />
          {field('email', 'userEmail', { slotProps: { htmlInput: { dir: 'ltr' } } })}
          {field('address', 'positionAddress')}
          {field('notes', 'fleetNotes', { multiline: true, minRows: 2 })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!form.name.trim()}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const VendorsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canRead = useFleetPermission('maintenance.read');
  const canWrite = useFleetPermission('maintenance.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const vendors = useVendors(canRead, reloadKey);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return vendors.filter(
      (vendor) =>
        !keyword ||
        [vendor.name, vendor.contact_name, vendor.phone].some((value) =>
          value?.toLowerCase().includes(keyword),
        ),
    );
  }, [vendors, search]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetVendorsPage']}
      description={t('fleetVendorsPageDescription')}
    >
      <FleetNotice permission="maintenance.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={filtered.length}
            actions={
              canWrite && (
                <Button variant="contained" size="small" onClick={() => setEditing(emptyVendor)}>
                  {t('fleetVendorAdd')}
                </Button>
              )
            }
          />
        }
        empty={canRead && filtered.length === 0}
        emptyState={{ icon: <StorefrontRoundedIcon />, title: t('fleetVendorsNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('fleetVendorContact')}</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('positionAddress')}</TableCell>
            {canWrite && <TableCell className={classes.action} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((vendor) => (
            <TableRow key={vendor.id} hover>
              <TableCell>{vendor.name}</TableCell>
              <TableCell>{t(vendorTypeKey(vendor.type))}</TableCell>
              <TableCell>{vendor.contact_name}</TableCell>
              <TableCell>
                <span dir="ltr">{vendor.phone}</span>
              </TableCell>
              <TableCell>
                {vendor.address}
                <WazeButton place={{ address: vendor.address }} label={vendor.name} />
              </TableCell>
              {canWrite && (
                <TableCell className={classes.action}>
                  <Tooltip title={t('sharedEdit')}>
                    <IconButton
                      size="small"
                      aria-label={t('sharedEdit')}
                      onClick={() => setEditing(vendor)}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {editing && (
        <VendorDialog
          vendor={editing}
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

export default VendorsPage;

import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../common/components/table/ResponsiveTable';
import ScanDocumentButton from './components/ScanDocumentButton';
import { invoiceValues } from '../common/fleet/documentScan';
import { makeStyles } from 'tss-react/mui';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import SaveBar from '../settings/components/SaveBar';
import SettingsMenu from '../settings/components/SettingsMenu';
import FileInput from '../common/components/FileInput';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  ITEM_KINDS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  itemTotal,
  itemsTotal,
  odometerKm,
  statusChange,
} from '../common/fleet/workOrders';
import { maintenanceStatus } from '../common/fleet/maintenanceStatus';
import { garageLicenseIssue } from '../common/fleet/safetyOfficer';
import FleetNotice from './components/FleetNotice';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';
import {
  discardUnsavedChanges,
  goBack,
  useFormChanges,
  useLeaveGuard,
} from '../common/components/confirm/unsavedChanges';
import { VendorDialog } from './VendorsPage';
import { workOrderStatusKey, workOrderTypeKey } from './WorkOrdersPage';
import {
  ensureVehicle,
  FILES_BUCKET,
  money,
  openFleetFile,
  uploadFleetFile,
  useVendors,
} from './fleetData';
import { fleetSave, withUploadedFile } from '../common/fleet/fleetSave';
import { loadMaintenanceLinks, markMaintenanceDone } from './maintenance';
import { DateField } from '../common/components/pickers';
import WazeButton from '../common/components/WazeButton';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  full: {
    gridColumn: '1 / -1',
  },
  vendorRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    '& .MuiTextField-root': {
      flex: 1,
    },
  },
  itemCell: {
    paddingInline: theme.spacing(0.5),
    verticalAlign: 'top',
  },
  total: {
    fontWeight: 700,
    textAlign: 'end',
    fontVariantNumeric: 'tabular-nums',
  },
}));

const emptyItem = () => ({
  key: crypto.randomUUID(),
  kind: 'part',
  description: '',
  quantity: 1,
  unit_price: 0,
});

// Roadmap stage 2: one work order with its lines. Closing it can also reset the vehicle's
// Traccar maintenance counter, so the next service is counted from now.
const WorkOrderPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('maintenance.read');
  const canWrite = useFleetPermission('maintenance.write');

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const [vendorKey, setVendorKey] = useState(0);
  const vendors = useVendors(canRead, vendorKey);
  const [addingVendor, setAddingVendor] = useState(false);

  const [order, setOrder] = useState(null);
  // Only licensed garages (regulation 585): warn when the chosen one is not known to be.
  const selectedVendor = vendors.find((vendor) => vendor.id === order?.vendor_id);
  const garageIssue = garageLicenseIssue(selectedVendor);
  const [items, setItems] = useState([]);
  const [deviceId, setDeviceId] = useState(searchParams.get('deviceId') || '');
  const [invoice, setInvoice] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [resetIds, setResetIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    if (!id) {
      // AI-03: a fault card opens a repair order with its title and notes filled in.
      setOrder({
        title: searchParams.get('title') || '',
        type: searchParams.get('type') === 'repair' ? 'repair' : 'service',
        status: 'open',
        notes: searchParams.get('notes') || '',
      });
      setItems([emptyItem()]);
      return;
    }
    const client = getFleetClient();
    const row = unwrap(
      await client
        .from('work_orders')
        .select('*, vehicles(traccar_device_id)')
        .eq('id', id)
        .single(),
    );
    const lines = unwrap(
      await client.from('work_order_items').select('*').eq('work_order_id', id).order('sort_order'),
    );
    setOrder(row);
    setDeviceId(String(row.vehicles?.traccar_device_id || ''));
    setItems((lines || []).map((line) => ({ ...line, key: line.id })));
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- the address fills a new order once
  }, [id, canRead]);

  // Traccar maintenance linked to the chosen vehicle, offered for reset when closing.
  useAsyncTask(
    async ({ signal }) => {
      setResetIds([]);
      if (!deviceId) {
        setMaintenance([]);
        return;
      }
      const { links } = await loadMaintenanceLinks([deviceId], signal);
      setMaintenance(links.map((link) => link.maintenance));
    },
    [deviceId],
  );

  const deviceOptions = useMemo(
    () =>
      Object.values(devices)
        .map((device) => ({
          id: String(device.id),
          name: device.attributes?.plateNumber
            ? `${device.name} · ${device.attributes.plateNumber}`
            : device.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  const set = (changes) => setOrder((current) => ({ ...current, ...changes }));

  const chooseDevice = (value) => {
    setDeviceId(value);
    if (!id && value && !order.odometer_km) {
      set({ odometer_km: odometerKm(positions[value]) });
    }
  };

  const setItem = (key, changes) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );

  const closing = order && order.status === 'done' && order.closed_at == null;

  // ADM-05: unsaved changes are asked about before leaving.
  const leave = useLeaveGuard(useConfirm(), t);
  useFormChanges({ order, items, deviceId, invoice: invoice?.name, resetIds }, Boolean(order));

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const vehicleId = await ensureVehicle(devices[deviceId], profile);
      const original = id ? order : {};
      const lines = items
        .filter((item) => item.description.trim())
        .map((item) => ({
          kind: item.kind,
          description: item.description.trim(),
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
        }));
      // ARC-05: the order and its lines in one transaction; a new invoice file is removed again
      // if the save fails.
      await withUploadedFile(
        async () => (invoice ? uploadFleetFile(profile.org_id, 'work-orders', invoice) : null),
        (path) => getFleetClient().storage.from(FILES_BUCKET).remove([path]),
        async (uploaded) => {
          const payload = {
            vehicle_id: vehicleId,
            vendor_id: order.vendor_id || null,
            title: order.title.trim(),
            type: order.type,
            scheduled_at: order.scheduled_at || null,
            odometer_km: order.odometer_km === '' ? null : (order.odometer_km ?? null),
            engine_hours: order.engine_hours === '' ? null : (order.engine_hours ?? null),
            invoice_number: order.invoice_number || null,
            invoice_path: uploaded || order.invoice_path || null,
            notes: order.notes || null,
            ...statusChange(original, order.status),
            ...(resetIds.length && { traccar_maintenance_id: resetIds[0] }),
          };
          return fleetSave(
            'work_order',
            id,
            id ? payload : { ...payload, org_id: profile.org_id, created_by: profile.id },
            lines,
          );
        },
      );
      for (const maintenanceId of resetIds) {
        const target = maintenance.find((it) => it.id === maintenanceId);
        const state = maintenanceStatus(target, positions[deviceId]);
        if (state.current != null) {
          await markMaintenanceDone(target, state.current);
        }
      }
      discardUnsavedChanges();
      navigate('/fleet/work-orders');
    } finally {
      setSaving(false);
    }
  });

  const valid = order && order.title?.trim() && deviceId && devices[deviceId];

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetWorkOrdersPage']}
      title={order?.number ? `${t('fleetWorkOrder')} ${order.number}` : t('fleetWorkOrderAdd')}
      footer={
        canWrite && (
          <SaveBar
            onCancel={() => leave(() => goBack(navigate))}
            onSave={handleSave}
            saving={saving}
            disabled={!valid}
          />
        )
      }
    >
      <FleetNotice permission="maintenance.read" />
      {order && (
        <>
          <FormSection title={t('fleetWorkOrderDetails')} icon={<HandymanRoundedIcon />}>
            <div className={classes.grid}>
              <TextField
                select
                label={t('fleetEntityVehicle')}
                value={deviceId}
                onChange={(event) => chooseDevice(event.target.value)}
                disabled={Boolean(id)}
              >
                {deviceOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('fleetWorkOrderTitle')}
                value={order.title || ''}
                onChange={(event) => set({ title: event.target.value })}
              />
              <TextField
                select
                label={t('sharedType')}
                value={order.type}
                onChange={(event) => set({ type: event.target.value })}
              >
                {WORK_ORDER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {t(workOrderTypeKey(type))}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('deviceStatus')}
                value={order.status}
                onChange={(event) => set({ status: event.target.value })}
              >
                {WORK_ORDER_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {t(workOrderStatusKey(status))}
                  </MenuItem>
                ))}
              </TextField>
              <div className={classes.vendorRow}>
                <TextField
                  select
                  label={t('fleetVendor')}
                  value={order.vendor_id || ''}
                  onChange={(event) => set({ vendor_id: event.target.value })}
                >
                  <MenuItem value="">&nbsp;</MenuItem>
                  {vendors.map((vendor) => (
                    <MenuItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedVendor?.address && (
                  <WazeButton
                    size="medium"
                    place={{ address: selectedVendor.address }}
                    label={selectedVendor.name}
                  />
                )}
                {canWrite && (
                  <Tooltip title={t('fleetVendorAdd')}>
                    <IconButton
                      aria-label={t('fleetVendorAdd')}
                      onClick={() => setAddingVendor(true)}
                    >
                      <AddRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
              {garageIssue && (
                <Alert severity="warning" className={classes.full}>
                  {t(`safetyGarage${capitalize(garageIssue)}Warning`)}
                </Alert>
              )}
              <DateField
                label={t('fleetWorkOrderScheduled')}
                value={order.scheduled_at || ''}
                onChange={(event) => set({ scheduled_at: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="number"
                label={t('fleetOdometerKm')}
                value={order.odometer_km ?? ''}
                onChange={(event) => set({ odometer_km: event.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <TextField
                type="number"
                label={t('fleetEngineHours')}
                value={order.engine_hours ?? ''}
                onChange={(event) => set({ engine_hours: event.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <TextField
                className={classes.full}
                multiline
                minRows={2}
                label={t('fleetNotes')}
                value={order.notes || ''}
                onChange={(event) => set({ notes: event.target.value })}
              />
            </div>
          </FormSection>

          <FormSection title={t('fleetWorkOrderItems')} icon={<ReceiptLongRoundedIcon />}>
            <ResponsiveTable size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.itemCell}>{t('sharedType')}</TableCell>
                  <TableCell className={classes.itemCell}>{t('fleetItemDescription')}</TableCell>
                  <TableCell className={classes.itemCell}>{t('fleetItemQuantity')}</TableCell>
                  <TableCell className={classes.itemCell}>{t('fleetItemUnitPrice')}</TableCell>
                  <TableCell className={classes.itemCell}>{t('fleetCost')}</TableCell>
                  <TableCell className={classes.itemCell} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className={classes.itemCell}>
                      <TextField
                        select
                        size="small"
                        value={item.kind}
                        onChange={(event) => setItem(item.key, { kind: event.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': t('sharedType') } }}
                      >
                        {ITEM_KINDS.map((kind) => (
                          <MenuItem key={kind} value={kind}>
                            {t(`fleetItemKind${capitalize(kind)}`)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell className={classes.itemCell}>
                      <TextField
                        size="small"
                        fullWidth
                        value={item.description}
                        onChange={(event) => setItem(item.key, { description: event.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': t('fleetItemDescription') } }}
                      />
                    </TableCell>
                    <TableCell className={classes.itemCell}>
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => setItem(item.key, { quantity: event.target.value })}
                        slotProps={{
                          htmlInput: {
                            dir: 'ltr',
                            'aria-label': t('fleetItemQuantity'),
                            step: 'any',
                          },
                        }}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell className={classes.itemCell}>
                      <TextField
                        size="small"
                        type="number"
                        value={item.unit_price}
                        onChange={(event) => setItem(item.key, { unit_price: event.target.value })}
                        slotProps={{
                          htmlInput: {
                            dir: 'ltr',
                            'aria-label': t('fleetItemUnitPrice'),
                            step: 'any',
                          },
                        }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                    <TableCell className={classes.itemCell}>{money(itemTotal(item))}</TableCell>
                    <TableCell className={classes.itemCell}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedRemove')}
                        onClick={() =>
                          setItems((current) => current.filter((it) => it.key !== item.key))
                        }
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ResponsiveTable>
            <Button
              startIcon={<AddRoundedIcon />}
              onClick={() => setItems((current) => [...current, emptyItem()])}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('fleetItemAdd')}
            </Button>
            <Typography className={classes.total}>
              {t('fleetWorkOrderTotal')}: {money(itemsTotal(items))}
            </Typography>
            <div className={classes.grid}>
              {canWrite && (
                <ScanDocumentButton
                  kind="garage_invoice"
                  label={t('scanGarageInvoice')}
                  onApply={({ fields }, file) => {
                    // AI-04: the invoice's lines replace empty lines; the photo becomes the
                    // order's invoice file. Saved only with the order.
                    const scanned = invoiceValues(fields);
                    setItems((current) => [
                      ...current.filter((line) => line.description.trim()),
                      ...scanned.lines,
                    ]);
                    if (scanned.invoiceNumber) set({ invoice_number: scanned.invoiceNumber });
                    setInvoice(file);
                  }}
                />
              )}
              <TextField
                label={t('fleetInvoiceNumber')}
                value={order.invoice_number || ''}
                onChange={(event) => set({ invoice_number: event.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <FileInput
                placeholder={t('fleetInvoiceFile')}
                value={invoice}
                onChange={setInvoice}
                slotProps={{ htmlInput: { accept: 'image/*,application/pdf' } }}
              />
              {order.invoice_path && (
                <Button onClick={() => openFleetFile(order.invoice_path)}>
                  {t('fleetOpenFile')}
                </Button>
              )}
            </div>
          </FormSection>

          {canWrite && order.status === 'done' && maintenance.length > 0 && (
            <FormSection
              title={t('fleetWorkOrderResetTitle')}
              description={t('fleetWorkOrderResetDescription')}
              icon={<BuildRoundedIcon />}
            >
              {maintenance.map((item) => (
                <FormControlLabel
                  key={item.id}
                  control={
                    <Checkbox
                      checked={resetIds.includes(item.id)}
                      onChange={(event) =>
                        setResetIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((value) => value !== item.id),
                        )
                      }
                    />
                  }
                  label={item.name}
                />
              ))}
              {closing && (
                <Typography variant="body2" color="textSecondary">
                  {t('fleetWorkOrderResetHint')}
                </Typography>
              )}
            </FormSection>
          )}
        </>
      )}
      {addingVendor && (
        <VendorDialog
          vendor={{ name: '', type: 'garage' }}
          onClose={() => setAddingVendor(false)}
          onSaved={(vendor) => {
            setAddingVendor(false);
            setVendorKey((key) => key + 1);
            set({ vendor_id: vendor.id });
          }}
        />
      )}
    </FormPage>
  );
};

export default WorkOrderPage;

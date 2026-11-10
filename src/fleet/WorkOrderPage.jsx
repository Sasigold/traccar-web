import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
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
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import SaveBar from '../settings/components/SaveBar';
import SettingsMenu from '../settings/components/SettingsMenu';
import FileInput from '../common/components/FileInput';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient } from '../common/fleet/client';
import { linkIssues, loadIssues, loadWorkOrder, openIssuesOf } from './api/workOrders';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  ITEM_KINDS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  isOpenStatus,
  itemTotal,
  itemsTotal,
  odometerKm,
  statusChange,
  vatBreakdown,
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
  closeForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
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
  // ADM-19: the faults this order handles (they close with it), and the closing dialog.
  const [issues, setIssues] = useState([]);
  const [closingOpen, setClosingOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const issueIds = searchParams.getAll('issue');

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    if (!id) {
      // AI-03: a fault card opens a repair order with its title and notes filled in. ADM-19: so
      // does a fault from a check (?issue=<id>, more than one allowed).
      const faults = await loadIssues(client, issueIds);
      setIssues(faults);
      setOrder({
        title: searchParams.get('title') || faults.map((fault) => fault.title).join(', '),
        type: searchParams.get('type') === 'repair' || faults.length ? 'repair' : 'service',
        status: 'open',
        notes:
          searchParams.get('notes') ||
          faults
            .map((fault) => fault.description)
            .filter(Boolean)
            .join('\n'),
      });
      if (faults[0]?.vehicles?.traccar_device_id) {
        setDeviceId(String(faults[0].vehicles.traccar_device_id));
      }
      setItems([emptyItem()]);
      return;
    }
    const { order: row, items: lines } = await loadWorkOrder(client, id);
    setOrder(row);
    setDeviceId(String(row.vehicles?.traccar_device_id || ''));
    setItems(lines.map((line) => ({ ...line, key: line.id })));
    setIssues(await openIssuesOf(client, id));
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
            prices_include_vat: order.prices_include_vat ?? true,
            invoice_path: uploaded || order.invoice_path || null,
            notes: order.notes || null,
            ...statusChange(original, order.status),
            ...(resetIds.length && { traccar_maintenance_id: resetIds[0] }),
          };
          const savedId = await fleetSave(
            'work_order',
            id,
            id ? payload : { ...payload, org_id: profile.org_id, created_by: profile.id },
            lines,
          );
          if (!id) await linkIssues(getFleetClient(), savedId, issueIds);
          return savedId;
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

  // ADM-19: "Close order" asks for what closing needs (final km, invoice, the maintenance done,
  // checked by default), then saves the order as done.
  const [closeForm, setCloseForm] = useState(null);
  const startClosing = () => {
    const suggested = odometerKm(positions[deviceId]);
    setCloseForm({
      odometer: order.odometer_km ?? (suggested == null ? '' : suggested),
      invoice: order.invoice_number || '',
      resetIds: maintenance.map((item) => item.id),
    });
    setClosingOpen(true);
  };
  const confirmClosing = () => {
    setOrder((current) => ({
      ...current,
      status: 'done',
      odometer_km: closeForm.odometer === '' ? null : Number(closeForm.odometer),
      invoice_number: closeForm.invoice,
    }));
    setResetIds(closeForm.resetIds);
    setClosingOpen(false);
    setCloseRequested(true);
  };
  useEffect(() => {
    if (closeRequested) {
      setCloseRequested(false);
      handleSave();
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- saves once the closing is applied
  }, [closeRequested]);
  const canClose = canWrite && id && order && isOpenStatus(order.status);
  const vat = vatBreakdown(itemsTotal(items), order?.prices_include_vat ?? true);

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetWorkOrdersPage']}
      title={order?.number ? `${t('fleetWorkOrder')} ${order.number}` : t('fleetWorkOrderAdd')}
      footer={
        canWrite && (
          <SaveBar
            onCancel={() => leave(() => goBack(navigate, '/fleet/work-orders'))}
            onSave={handleSave}
            saving={saving}
            disabled={!valid}
          >
            {id && (
              <Button
                color="inherit"
                startIcon={<PrintRoundedIcon />}
                onClick={() => window.print()}
              >
                {t('fleetWorkOrderPrint')}
              </Button>
            )}
            {canClose && (
              <Button variant="outlined" onClick={startClosing} disabled={!valid || saving}>
                {t('fleetWorkOrderClose')}
              </Button>
            )}
          </SaveBar>
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
                onChange={(event) => {
                  set({ status: event.target.value });
                  // ADM-19: done means the maintenance was done; it is checked by default.
                  if (event.target.value === 'done' && !resetIds.length) {
                    setResetIds(maintenance.map((item) => item.id));
                  }
                }}
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
            <FormControlLabel
              control={
                <Switch
                  checked={order.prices_include_vat ?? true}
                  onChange={(event) => set({ prices_include_vat: event.target.checked })}
                  disabled={!canWrite}
                />
              }
              label={t('fleetWorkOrderPricesIncludeVat')}
            />
            <Typography variant="body2" color="textSecondary">
              {t('fleetWorkOrderSubtotal')}: {money(vat.subtotal)} · {t('fleetWorkOrderVat')}:{' '}
              {money(vat.vat)}
            </Typography>
            <Typography className={classes.total}>
              {t('fleetWorkOrderTotal')}: {money(vat.total)}
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
      {closingOpen && closeForm && (
        <Dialog open onClose={() => setClosingOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t('fleetWorkOrderClose')}</DialogTitle>
          <DialogContent>
            <div className={classes.closeForm}>
              <TextField
                type="number"
                label={t('fleetWorkOrderFinalKm')}
                value={closeForm.odometer}
                onChange={(event) => setCloseForm({ ...closeForm, odometer: event.target.value })}
                slotProps={{ htmlInput: { min: 0, dir: 'ltr' } }}
              />
              <TextField
                label={t('fleetInvoiceNumber')}
                value={closeForm.invoice}
                onChange={(event) => setCloseForm({ ...closeForm, invoice: event.target.value })}
              />
              {maintenance.length > 0 && (
                <>
                  <Typography variant="subtitle2">{t('fleetWorkOrderResetTitle')}</Typography>
                  {maintenance.map((item) => (
                    <FormControlLabel
                      key={item.id}
                      control={
                        <Checkbox
                          checked={closeForm.resetIds.includes(item.id)}
                          onChange={(event) =>
                            setCloseForm({
                              ...closeForm,
                              resetIds: event.target.checked
                                ? [...closeForm.resetIds, item.id]
                                : closeForm.resetIds.filter((value) => value !== item.id),
                            })
                          }
                        />
                      }
                      label={item.name}
                    />
                  ))}
                </>
              )}
              <Typography className={classes.total}>
                {t('fleetWorkOrderTotal')}: {money(vat.total)}
              </Typography>
              {issues.length > 0 && (
                <Alert severity="info">
                  {t('fleetWorkOrderIssuesClose').replace('{0}', String(issues.length))}
                </Alert>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClosingOpen(false)}>{t('sharedCancel')}</Button>
            <Button variant="contained" onClick={confirmClosing}>
              {t('fleetWorkOrderClose')}
            </Button>
          </DialogActions>
        </Dialog>
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

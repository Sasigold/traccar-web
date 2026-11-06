import { useState } from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { describeChanges, isHiddenField, linkedIds, showValue } from '../../common/fleet/history';
import { vehicleDocumentTypes } from '../../common/fleet/fleetSync';
import { vehicleExpiryFields } from '../../common/fleet/fleetFields';
import FormSection from '../../settings/components/FormSection';

const useStyles = makeStyles()((theme) => ({
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  changes: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    overflowWrap: 'anywhere',
  },
}));

const config = {
  vehicle: { table: 'vehicles', idColumn: 'traccar_device_id', fk: 'vehicle_id' },
  driver: { table: 'drivers', idColumn: 'traccar_driver_id', fk: 'driver_id' },
};

const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());

// Database column -> translation key, so the history reads "Plate number" instead of "plate_number".
const fieldLabels = {
  plate_number: 'fleetPlateNumber',
  vin: 'fleetVin',
  make: 'fleetMake',
  model: 'fleetVehicleModel',
  year: 'fleetModelYear',
  fuel_type: 'fleetFuelType',
  ownership: 'fleetOwnership',
  leasing_end_date: 'fleetLeaseEndDate',
  leasing_company: 'historyFieldLeasingCompany',
  cost_center: 'historyFieldCostCenter',
  notes: 'fleetNotes',
  full_name: 'sharedName',
  name: 'sharedName',
  national_id: 'fleetNationalId',
  phone: 'sharedPhone',
  email: 'userEmail',
  hire_date: 'fleetHireDate',
  license_number: 'fleetLicenseNumber',
  license_classes: 'fleetLicenseClasses',
  license_expiry: 'fleetLicenseExpiry',
  driver_id: 'historyFieldDriver',
  vehicle_id: 'historyFieldVehicle',
  is_primary: 'historyFieldIsPrimary',
  starts_at: 'historyFieldStartsAt',
  ends_at: 'historyFieldEndsAt',
  status: 'historyFieldStatus',
  document_type: 'fleetDocumentType',
  expires_at: 'historyFieldExpiresAt',
  issued_at: 'historyFieldIssuedAt',
  title: 'historyFieldTitle',
  description: 'sharedDescription',
  type: 'sharedType',
  severity: 'historyFieldSeverity',
  occurred_at: 'historyFieldOccurredAt',
  total: 'historyFieldAmount',
  amount: 'historyFieldAmount',
  liters: 'fleetFuelFieldLiters',
  odometer_km: 'historyFieldOdometer',
};

const statusLabels = {
  active: 'historyStatusActive',
  inactive: 'historyStatusInactive',
  suspended: 'historyStatusSuspended',
};

// document_type value -> the label of the matching validity field ("Test validity", ...).
const documentTypeLabels = {
  ...Object.fromEntries(
    Object.entries(vehicleDocumentTypes).map(([key, type]) => [
      type,
      vehicleExpiryFields.find((field) => field.key === key)?.labelKey,
    ]),
  ),
  driver_license: 'fleetDriverLicense',
};

// Roadmap 4.3: who changed what on this vehicle / driver and its related rows (audit log).
const HistorySection = ({ entity, traccarId }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canRead = useFleetPermission('audit.read');
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [links, setLinks] = useState({});

  useAsyncTask(async () => {
    if (!canRead || !traccarId) {
      return;
    }
    const { table, idColumn, fk } = config[entity];
    const client = getFleetClient();
    const record = unwrap(
      await client.from(table).select('id').eq(idColumn, traccarId).maybeSingle(),
    );
    if (!record) {
      setRows([]);
      return;
    }
    const id = record.id;
    const entries = unwrap(
      await client
        .from('audit_log')
        .select('*')
        .or(
          `and(table_name.eq.${table},row_id.eq.${id}),new_data->>${fk}.eq.${id},old_data->>${fk}.eq.${id}`,
        )
        .order('created_at', { ascending: false })
        .limit(50),
    );
    setRows(entries || []);
    const driverIds = linkedIds(entries || [], 'driver_id');
    const vehicleIds = linkedIds(entries || [], 'vehicle_id');
    const [drivers, vehicles] = await Promise.all([
      driverIds.length
        ? client.from('drivers').select('id, full_name').in('id', driverIds)
        : { data: [] },
      vehicleIds.length
        ? client.from('vehicles').select('id, plate_number').in('id', vehicleIds)
        : { data: [] },
    ]);
    setLinks({
      driver_id: Object.fromEntries((drivers.data || []).map((it) => [it.id, it.full_name])),
      vehicle_id: Object.fromEntries((vehicles.data || []).map((it) => [it.id, it.plate_number])),
    });
    const userIds = [...new Set((entries || []).map((entry) => entry.user_id).filter(Boolean))];
    if (userIds.length) {
      const people = unwrap(
        await client.from('profiles').select('id, full_name, email').in('id', userIds),
      );
      setNames(
        Object.fromEntries(
          (people || []).map((person) => [person.id, person.full_name || person.email]),
        ),
      );
    }
  }, [canRead, entity, traccarId]);

  if (!canRead || !traccarId) {
    return null;
  }

  const label = (key) => (fieldLabels[key] ? t(fieldLabels[key]) : key.replace(/_/g, ' '));

  const format = (key, value) => {
    if (value == null || value === '') return '—';
    if (key in links) return links[key][value] || t('historyUnknownLink');
    if (typeof value === 'boolean') return t(value ? 'sharedYes' : 'sharedNo');
    if (key === 'fuel_type') return t(`fleetFuel${camel(value)}`);
    if (key === 'ownership') return t(`fleetOwnership${camel(value)}`);
    if (key === 'status' && statusLabels[value]) return t(statusLabels[value]);
    if (key === 'document_type' && documentTypeLabels[value]) {
      return t(documentTypeLabels[value]);
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatTime(value, 'minutes');
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatTime(value, 'date');
    }
    return showValue(value);
  };

  return (
    <FormSection
      title={t('fleetHistoryTitle')}
      description={t('fleetHistoryDescription')}
      icon={<HistoryRoundedIcon />}
    >
      {rows && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {t('fleetHistoryEmpty')}
        </Typography>
      )}
      {rows && rows.length > 0 && (
        <ResponsiveTable size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('fleetOutboxCreated')}</TableCell>
              <TableCell>{t('fleetHistoryWho')}</TableCell>
              <TableCell>{t('fleetHistoryWhat')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={classes.nowrap}>
                  {formatTime(row.created_at, 'minutes')}
                </TableCell>
                <TableCell className={classes.nowrap}>
                  {names[row.user_id] || t('fleetHistorySystem')}
                </TableCell>
                <TableCell>
                  {`${t(`fleetHistoryAction${camel(row.action)}`)} · ${t(`fleetHistoryTable${camel(row.table_name)}`)}`}
                  {describeChanges(row, 6, { label, format, hide: isHiddenField }).map((line) => (
                    <div key={line} className={classes.changes} dir="auto">
                      {line}
                    </div>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResponsiveTable>
      )}
    </FormSection>
  );
};

export default HistorySection;

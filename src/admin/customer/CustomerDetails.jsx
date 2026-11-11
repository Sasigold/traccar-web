import { useState } from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import ValidatedField from '../../common/components/ValidatedField';
import { digitsOf, fieldError } from '../../common/util/israeliFields';
import { makeStyles } from 'tss-react/mui';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import FormSection from '../../settings/components/FormSection';
import { useFormChanges } from '../../common/components/confirm/unsavedChanges';
import { saveCustomer } from '../adminApi';
import { capitalize, customerStatuses } from '../CustomersPage';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}));

const fields = [
  { key: 'name', label: 'adminCustomerName', required: true, wide: true },
  { key: 'company_number', label: 'adminCompanyNumber', ltr: true, kind: 'companyId' },
  { key: 'contact_name', label: 'adminContactName' },
  { key: 'phone', label: 'sharedPhone', ltr: true, kind: 'phone' },
  { key: 'email', label: 'userEmail', ltr: true, kind: 'email' },
  { key: 'billing_email', label: 'adminBillingEmail', ltr: true, kind: 'email' },
  { key: 'address', label: 'adminAddress' },
];

const CustomerDetails = ({ customer, editable, onSaved, onSuspended, customers = [] }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [form, setForm] = useState(customer);
  const [saving, setSaving] = useState(false);
  // ADM-26: leaving the tab (or the page) with changes asks first.
  useFormChanges(form, true);

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const saved = await saveCustomer({ ...form, name: form.name.trim() });
      onSaved(saved);
      if (form.status === 'suspended' && customer.status !== 'suspended') {
        await onSuspended?.(saved);
      }
    } finally {
      setSaving(false);
    }
  });

  const dirty = JSON.stringify(form) !== JSON.stringify(customer);

  return (
    <FormSection icon={<StoreRoundedIcon />} title={t('adminCustomerDetails')}>
      <div className={classes.grid}>
        {fields.map((field) =>
          field.kind ? (
            <ValidatedField
              key={field.key}
              kind={field.kind}
              label={t(field.label)}
              value={form[field.key]}
              onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
              disabled={!editable}
              // ADM-06: another customer with the same company number.
              duplicateOf={
                field.key === 'company_number'
                  ? (value) =>
                      customers.find(
                        (other) =>
                          other.id !== customer.id &&
                          digitsOf(other.company_number) === digitsOf(value),
                      )?.name
                  : undefined
              }
            />
          ) : (
            <TextField
              key={field.key}
              className={field.wide ? classes.wide : undefined}
              required={field.required}
              label={t(field.label)}
              value={form[field.key] || ''}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              disabled={!editable}
              slotProps={field.ltr ? { htmlInput: { dir: 'ltr' } } : undefined}
            />
          ),
        )}
        <TextField
          select
          label={t('deviceStatus')}
          value={form.status || 'active'}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
          disabled={!editable}
        >
          {customerStatuses.map((status) => (
            <MenuItem key={status} value={status}>
              {t(`adminCustomerStatus${capitalize(status)}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          className={classes.wide}
          multiline
          minRows={3}
          label={t('adminNotes')}
          value={form.notes || ''}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          disabled={!editable}
        />
      </div>
      {editable && (
        <div className={classes.actions}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              saving ||
              !form.name?.trim() ||
              (customer.id && !dirty) ||
              fields.some((field) => field.kind && fieldError(field.kind, form[field.key]))
            }
          >
            {customer.id ? t('sharedSave') : t('adminCreateCustomer')}
          </Button>
        </div>
      )}
    </FormSection>
  );
};

export default CustomerDetails;

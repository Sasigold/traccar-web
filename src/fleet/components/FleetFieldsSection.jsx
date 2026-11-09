import { useState } from 'react';
import { Autocomplete, Chip, MenuItem, TextField } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FormSection from '../../settings/components/FormSection';
import ExpiryBadge from './ExpiryBadge';
import { DateField } from '../../common/components/pickers';
import { FIELD_KINDS, fieldError } from '../../common/util/israeliFields';

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
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& .MuiTextField-root': {
      flex: 1,
    },
  },
}));

const optionLabel = (t, field, option) =>
  field.optionPrefix
    ? t(`${field.optionPrefix}${option.replace(/^\w/, (c) => c.toUpperCase())}`)
    : option;

// Renders structured fleet fields (see common/fleet/fleetFields.js) that live in `attributes`.
// ADM-06: a field with a `kind` gets the right keyboard on phones, is normalized and checked when
// it loses focus, and `duplicateOf(key, value)` (optional) names an existing item with the same
// value ("רכב עם מספר רישוי זה כבר קיים: טנדר 12").
const FleetFieldsSection = ({
  title,
  description,
  icon,
  fields,
  attributes,
  setAttributes,
  showExpiry,
  actions,
  duplicateOf,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const values = attributes || {};
  // Messages shown after a field was left: key -> text.
  const [messages, setMessages] = useState({});

  const update = (key, value) => {
    const next = { ...values };
    if (value === '' || value == null || (Array.isArray(value) && !value.length)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setAttributes(next);
  };

  const check = async (field, raw) => {
    if (!field.kind) return;
    const kind = FIELD_KINDS[field.kind];
    const value = raw === '' || raw == null ? raw : kind.normalize(raw);
    if (value !== raw) {
      update(field.key, value);
    }
    const error = fieldError(field.kind, value);
    let message = error ? t(error) : null;
    if (!message && value && duplicateOf) {
      const existing = await duplicateOf(field.key, value);
      if (existing) {
        message = t('validationDuplicate').replace('{0}', existing);
      }
    }
    setMessages((current) => ({ ...current, [field.key]: message }));
  };

  const renderField = (field) => {
    const label = t(field.labelKey);
    const value = values[field.key];
    const kind = field.kind ? FIELD_KINDS[field.kind] : null;
    const ltr = {
      htmlInput: {
        ...(field.ltr ? { dir: 'ltr' } : {}),
        ...(kind?.inputMode ? { inputMode: kind.inputMode } : {}),
      },
    };
    const message = messages[field.key];
    // The error shows once the field was left, and goes away as soon as the value is valid.
    const invalid = Boolean(message) && Boolean(fieldError(field.kind, value) || message);
    const feedback = field.kind
      ? {
          onBlur: (event) => check(field, event.target.value),
          error: invalid,
          helperText: invalid ? message : undefined,
          ...(kind?.type ? { type: kind.type } : {}),
        }
      : {};
    switch (field.type) {
      case 'select':
        return (
          <TextField
            key={field.key}
            select
            label={label}
            value={value || ''}
            onChange={(event) => update(field.key, event.target.value)}
          >
            <MenuItem value="">&nbsp;</MenuItem>
            {field.options.map((option) => (
              <MenuItem key={option} value={option}>
                {optionLabel(t, field, option)}
              </MenuItem>
            ))}
          </TextField>
        );
      case 'multiselect':
        return (
          <Autocomplete
            key={field.key}
            multiple
            options={field.options}
            value={Array.isArray(value) ? value : []}
            onChange={(_, selected) => update(field.key, selected)}
            renderValue={(selected, getItemProps) =>
              selected.map((option, index) => {
                const { key, ...itemProps } = getItemProps({ index });
                return <Chip key={key} size="small" label={option} dir="ltr" {...itemProps} />;
              })
            }
            renderInput={(params) => <TextField {...params} label={label} />}
          />
        );
      case 'date':
        return (
          <div key={field.key} className={classes.dateRow}>
            <DateField
              label={label}
              value={value || ''}
              onChange={(event) => update(field.key, event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {showExpiry && value && <ExpiryBadge date={value} />}
          </div>
        );
      case 'number':
        return (
          <TextField
            key={field.key}
            type="number"
            label={label}
            value={value ?? ''}
            onChange={(event) =>
              update(field.key, event.target.value === '' ? '' : Number(event.target.value))
            }
            slotProps={ltr}
            {...feedback}
          />
        );
      case 'multiline':
        return (
          <TextField
            key={field.key}
            className={classes.full}
            multiline
            minRows={2}
            label={label}
            value={value || ''}
            onChange={(event) => update(field.key, event.target.value)}
          />
        );
      default:
        return (
          <TextField
            key={field.key}
            label={label}
            value={value || ''}
            onChange={(event) => {
              update(field.key, event.target.value);
              if (messages[field.key] && !fieldError(field.kind, event.target.value)) {
                setMessages((current) => ({ ...current, [field.key]: null }));
              }
            }}
            slotProps={ltr}
            {...feedback}
          />
        );
    }
  };

  return (
    <FormSection title={title} description={description} icon={icon} actions={actions}>
      <div className={classes.grid}>{fields.map(renderField)}</div>
    </FormSection>
  );
};

export default FleetFieldsSection;

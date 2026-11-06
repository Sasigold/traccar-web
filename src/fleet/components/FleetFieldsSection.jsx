import { Autocomplete, Chip, MenuItem, TextField } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FormSection from '../../settings/components/FormSection';
import ExpiryBadge from './ExpiryBadge';

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
const FleetFieldsSection = ({
  title,
  description,
  icon,
  fields,
  attributes,
  setAttributes,
  showExpiry,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const values = attributes || {};

  const update = (key, value) => {
    const next = { ...values };
    if (value === '' || value == null || (Array.isArray(value) && !value.length)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setAttributes(next);
  };

  const renderField = (field) => {
    const label = t(field.labelKey);
    const value = values[field.key];
    const ltr = field.ltr ? { htmlInput: { dir: 'ltr' } } : undefined;
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
            <TextField
              type="date"
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
            onChange={(event) => update(field.key, event.target.value)}
            slotProps={ltr}
          />
        );
    }
  };

  return (
    <FormSection title={title} description={description} icon={icon}>
      <div className={classes.grid}>{fields.map(renderField)}</div>
    </FormSection>
  );
};

export default FleetFieldsSection;

import { Autocomplete, TextField } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';

// Picks a customer by id. `customers` are rows of the customers table.
const CustomerSelect = ({
  customers,
  value,
  onChange,
  label,
  allowEmpty = true,
  disabled,
  size,
  helperText,
}) => {
  const t = useTranslation();
  const options = customers.filter(
    (customer) => customer.status !== 'archived' || customer.id === value,
  );
  const selected = options.find((customer) => customer.id === value) || null;
  return (
    <Autocomplete
      size={size}
      options={options}
      value={selected}
      disabled={disabled}
      disableClearable={!allowEmpty}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, other) => option.id === other.id}
      onChange={(_, option) => onChange(option ? option.id : null)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t('adminCustomer')}
          placeholder={allowEmpty ? t('adminNoCustomer') : undefined}
          helperText={helperText}
        />
      )}
    />
  );
};

export default CustomerSelect;

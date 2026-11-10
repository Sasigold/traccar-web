import { InputAdornment, TextField } from '@mui/material';
import { useTranslation } from './LocalizationProvider';

// ADM-24: an amount in shekels. A text field with the decimal keyboard (no wheel changes, no
// "e"), the ₪ sign, and whether the amount includes VAT.
export const cleanAmount = (text) => {
  const cleaned = String(text ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const MoneyField = ({
  value,
  onChange,
  vatIncluded = true,
  helperText,
  slotProps = {},
  ...props
}) => {
  const t = useTranslation();
  return (
    <TextField
      {...props}
      value={value ?? ''}
      onChange={(event) =>
        onChange({ ...event, target: { ...event.target, value: cleanAmount(event.target.value) } })
      }
      helperText={helperText ?? (vatIncluded ? t('moneyVatIncluded') : t('moneyVatExcluded'))}
      slotProps={{
        ...slotProps,
        input: {
          endAdornment: <InputAdornment position="end">₪</InputAdornment>,
          ...slotProps.input,
        },
        htmlInput: { dir: 'ltr', inputMode: 'decimal', ...slotProps.htmlInput },
      }}
    />
  );
};

export default MoneyField;

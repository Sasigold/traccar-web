import { useState } from 'react';
import { TextField } from '@mui/material';
import { useTranslation } from './LocalizationProvider';
import { FIELD_KINDS, fieldError } from '../util/israeliFields';

// ADM-06: a text field for an Israeli identifier (`kind`: plate, israeliId, companyId, phone,
// email, vin, year): the right keyboard on phones, normalized and checked when it loses focus,
// and `duplicateOf(value)` (optional) names an existing item with the same value.
const ValidatedField = ({ kind, value, onChange, duplicateOf, slotProps, ...props }) => {
  const t = useTranslation();
  const [message, setMessage] = useState(null);
  const config = FIELD_KINDS[kind];

  const handleBlur = async (event) => {
    const raw = event.target.value;
    const normalized = raw ? config.normalize(raw) : raw;
    if (normalized !== raw) {
      onChange(normalized);
    }
    const error = fieldError(kind, normalized);
    let text = error ? t(error) : null;
    if (!text && normalized && duplicateOf) {
      const existing = await duplicateOf(normalized);
      if (existing) {
        text = t('validationDuplicate').replace('{0}', existing);
      }
    }
    setMessage(text);
  };

  return (
    <TextField
      {...props}
      type={config.type || props.type}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value);
        if (message && !fieldError(kind, event.target.value)) {
          setMessage(null);
        }
      }}
      onBlur={handleBlur}
      error={Boolean(message) || props.error}
      helperText={message || props.helperText}
      slotProps={{
        ...slotProps,
        htmlInput: {
          dir: 'ltr',
          ...(config.inputMode ? { inputMode: config.inputMode } : {}),
          ...slotProps?.htmlInput,
        },
      }}
    />
  );
};

export default ValidatedField;

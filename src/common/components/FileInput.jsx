import { useRef } from 'react';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from './LocalizationProvider';

const FileInput = ({ placeholder, value, onChange, slotProps }) => {
  const t = useTranslation();
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const handleChange = (event) => {
    onChange?.(event.target.files?.[0] || null);
    event.target.value = '';
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange?.(null);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
        {...slotProps?.htmlInput}
      />
      <TextField
        value={value?.name ?? ''}
        placeholder={placeholder}
        onClick={openPicker}
        slotProps={{
          input: {
            readOnly: true,
            sx: { cursor: 'pointer' },
            endAdornment: value && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={handleClear}
                  aria-label={t('a11yClear')}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
          htmlInput: { sx: { cursor: 'pointer' } },
        }}
      />
    </>
  );
};

export default FileInput;

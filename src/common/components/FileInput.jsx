import { useRef } from 'react';
import { Button, Chip, Stack } from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import { useTranslation } from './LocalizationProvider';

// ADM-24: a real button that says what to choose (reachable by keyboard), and the chosen file as
// a chip that can be removed. `placeholder` is the button's label, as before.
const FileInput = ({ placeholder, value, onChange, slotProps, disabled }) => {
  const t = useTranslation();
  const inputRef = useRef(null);

  const handleChange = (event) => {
    onChange?.(event.target.files?.[0] || null);
    event.target.value = '';
  };

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
        {...slotProps?.htmlInput}
      />
      <Button
        variant="outlined"
        startIcon={<UploadFileRoundedIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {placeholder || t('sharedSelectFile')}
      </Button>
      {value?.name && (
        <Chip
          label={value.name}
          onDelete={() => onChange?.(null)}
          deleteIcon={<CancelRoundedIcon titleAccess={t('a11yClear')} />}
          sx={{ maxWidth: '100%' }}
        />
      )}
    </Stack>
  );
};

export default FileInput;

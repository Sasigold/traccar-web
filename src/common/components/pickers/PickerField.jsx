import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../LocalizationProvider';

// The closed state of every picker: a read-only TextField that opens the picker on click or
// keyboard, with the picker icon and an optional clear button. Accepts the usual TextField props,
// so pages keep their label / helperText / size / fullWidth / slotProps.
const PickerField = ({
  display,
  icon,
  onOpen,
  onClear,
  clearable,
  disabled,
  slotProps = {},
  inputRef,
  placeholder,
  ...props
}) => {
  const t = useTranslation();
  const theme = useTheme();

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      onOpen(event.currentTarget);
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && clearable && display) {
      event.preventDefault();
      onClear();
    }
  };

  const { input: inputSlot = {}, htmlInput: htmlInputSlot = {}, ...otherSlots } = slotProps;

  return (
    <TextField
      {...props}
      value={display}
      disabled={disabled}
      inputRef={inputRef}
      onClick={(event) => !disabled && onOpen(event.currentTarget)}
      onKeyDown={handleKeyDown}
      slotProps={{
        ...otherSlots,
        input: {
          ...inputSlot,
          readOnly: true,
          sx: { cursor: disabled ? 'default' : 'pointer', ...inputSlot.sx },
          endAdornment: (
            <InputAdornment position="end" sx={{ gap: 0.25 }}>
              {clearable && display && !disabled && (
                <Tooltip title={t('pickerClear')}>
                  <IconButton
                    size="small"
                    edge={false}
                    aria-label={t('pickerClear')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClear();
                    }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton
                size="small"
                edge="end"
                tabIndex={-1}
                disabled={disabled}
                aria-hidden
                sx={{ color: 'text.secondary' }}
              >
                {icon}
              </IconButton>
            </InputAdornment>
          ),
        },
        htmlInput: {
          ...htmlInputSlot,
          dir: 'ltr',
          placeholder,
          'aria-haspopup': 'dialog',
          style: {
            cursor: disabled ? 'default' : 'pointer',
            textAlign: theme.direction === 'rtl' ? 'right' : 'left',
            ...htmlInputSlot.style,
          },
        },
      }}
    />
  );
};

export default PickerField;

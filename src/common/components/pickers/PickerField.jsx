import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../LocalizationProvider';

// The closed state of every picker: a read-only TextField that opens the picker on click or
// keyboard, with the picker icon and an optional clear button. Accepts the usual TextField props,
// so pages keep their label / helperText / size / fullWidth / slotProps.
//
// ADM-24: with `typing` ({ value, onChange, onCommit, placeholder }) the field can be typed in;
// the icon (or Alt+Down / Down) opens the picker instead of a click on the text.
const PickerField = ({
  typing,
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
    if (typing) {
      if (event.key === 'Enter') {
        event.preventDefault();
        typing.onCommit();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        onOpen(event.currentTarget);
      }
      return;
    }
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
      value={typing ? typing.value : display}
      disabled={disabled}
      inputRef={inputRef}
      onClick={(event) => !disabled && !typing && onOpen(event.currentTarget)}
      onChange={typing ? (event) => typing.onChange(event.target.value) : undefined}
      onBlur={typing ? () => typing.onCommit() : undefined}
      onKeyDown={handleKeyDown}
      slotProps={{
        ...otherSlots,
        input: {
          ...inputSlot,
          readOnly: !typing,
          sx: { cursor: disabled || typing ? undefined : 'pointer', ...inputSlot.sx },
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
              {typing ? (
                <IconButton
                  size="small"
                  edge="end"
                  disabled={disabled}
                  aria-label={t('pickerOpenCalendar')}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(
                      event.currentTarget.closest('.MuiInputBase-root') || event.currentTarget,
                    );
                  }}
                  sx={{ color: 'text.secondary' }}
                >
                  {icon}
                </IconButton>
              ) : (
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
              )}
            </InputAdornment>
          ),
        },
        htmlInput: {
          ...htmlInputSlot,
          dir: 'ltr',
          placeholder: typing ? typing.placeholder : placeholder,
          ...(typing
            ? { inputMode: 'numeric', autoComplete: 'off' }
            : { 'aria-haspopup': 'dialog' }),
          style: {
            cursor: disabled ? 'default' : typing ? 'text' : 'pointer',
            textAlign: theme.direction === 'rtl' ? 'right' : 'left',
            ...htmlInputSlot.style,
          },
        },
      }}
    />
  );
};

export default PickerField;

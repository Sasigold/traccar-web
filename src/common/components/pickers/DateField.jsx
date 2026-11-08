import { useState } from 'react';
import dayjs from 'dayjs';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { useTranslation } from '../LocalizationProvider';
import PickerField from './PickerField';
import PickerSurface from './PickerSurface';
import CalendarPanel from './CalendarPanel';
import PickerFooter from './PickerFooter';
import usePickerState from './usePickerState';
import {
  DATE_FORMAT,
  changeEvent,
  displayDate,
  formatValue,
  isOutside,
  parseValue,
} from './pickerUtils';

// Date picker. Value and onChange use 'YYYY-MM-DD' strings through a change event
// (`event.target.value`), exactly like the native date input it replaces.
const DateField = ({
  value,
  onChange,
  name,
  min,
  max,
  required,
  clearable = !required,
  // eslint-disable-next-line no-unused-vars
  type,
  ...props
}) => {
  const t = useTranslation();
  const picker = usePickerState();
  const selected = parseValue(value);
  const minDate = parseValue(min);
  const maxDate = parseValue(max);
  const [month, setMonth] = useState(() => (selected || dayjs()).startOf('month'));

  const emit = (date) => onChange?.(changeEvent(formatValue(date, DATE_FORMAT), name));

  const open = (element) => {
    setMonth((selected || dayjs()).startOf('month'));
    picker.openAt(element);
  };

  const today = dayjs();

  return (
    <>
      <PickerField
        {...props}
        name={name}
        required={required}
        display={displayDate(selected)}
        icon={<EventRoundedIcon fontSize="small" />}
        onOpen={open}
        onClear={() => emit(null)}
        clearable={clearable}
      />
      <PickerSurface anchorEl={picker.anchorEl} open={picker.open} onClose={picker.close}>
        <CalendarPanel
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          min={minDate}
          max={maxDate}
          onSelect={(day) => {
            emit(day);
            picker.close();
          }}
        />
        <PickerFooter
          actions={[
            clearable && {
              label: t('pickerClear'),
              onClick: () => {
                emit(null);
                picker.close();
              },
              disabled: !selected,
            },
            {
              label: t('reportToday'),
              onClick: () => {
                emit(today);
                picker.close();
              },
              disabled: isOutside(today, minDate, maxDate),
            },
          ]}
        />
      </PickerSurface>
    </>
  );
};

export default DateField;

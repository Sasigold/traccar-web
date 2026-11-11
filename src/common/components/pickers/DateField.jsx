// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useState } from 'react';
import dayjs from 'dayjs';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { useTranslation } from '../LocalizationProvider';
import PickerField from './PickerField';
import PickerSurface from './PickerSurface';
import CalendarPanel from './CalendarPanel';
import PickerFooter from './PickerFooter';
import usePickerState from './usePickerState';
import { addToDate, dateOrder, maskDate, parseTypedDate } from './dateTyping';
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
  // ADM-24: "+1 year" and "+6 months" in the picker, for renewing a validity date.
  renewal = false,
  error,
  helperText,
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

  // ADM-24: typed as DD/MM/YYYY (the locale's order); kept as a draft until it is a whole date.
  const localeFormat =
    dayjs.Ls[dayjs.locale()]?.formats?.L || (dayjs.locale() === 'en' ? 'MM/DD/YYYY' : 'DD/MM/YYYY');
  const order = dateOrder(localeFormat);
  const [draft, setDraft] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    if (draft === null) return;
    if (draft === '') {
      if (clearable) emit(null);
      setDraft(null);
      setInvalid(false);
      return;
    }
    const parsed = parseTypedDate(draft, order);
    const date = parsed ? dayjs(parsed) : null;
    if (date && !isOutside(date, minDate, maxDate)) {
      emit(date);
      setDraft(null);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

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
        error={error || invalid}
        helperText={invalid ? t('pickerInvalidDate') : helperText}
        typing={{
          value: draft ?? displayDate(selected),
          placeholder: localeFormat,
          onChange: (text) => {
            setDraft(maskDate(text));
            setInvalid(false);
          },
          onCommit: commit,
        }}
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
            renewal && {
              label: t('pickerPlusYear'),
              onClick: () => {
                emit(dayjs(addToDate(value, 1, 'year')));
                picker.close();
              },
            },
            renewal && {
              label: t('pickerPlusHalfYear'),
              onClick: () => {
                emit(dayjs(addToDate(value, 6, 'month')));
                picker.close();
              },
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

// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import dayjs from 'dayjs';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { useTranslation } from '../LocalizationProvider';
import PickerField from './PickerField';
import PickerSurface from './PickerSurface';
import TimeColumns from './TimeColumns';
import PickerFooter from './PickerFooter';
import usePickerState from './usePickerState';
import {
  TIME_FORMAT,
  changeEvent,
  displayTime,
  formatValue,
  parseValue,
  roundToStep,
} from './pickerUtils';

// Time-of-day picker ('HH:mm'). Minutes step by 5 unless `minuteStep` says otherwise.
const TimeField = ({
  value,
  onChange,
  name,
  minuteStep = 5,
  required,
  clearable = !required,
  // eslint-disable-next-line no-unused-vars
  type,
  ...props
}) => {
  const t = useTranslation();
  const picker = usePickerState();
  const selected = parseValue(value);

  const emit = (date) => onChange?.(changeEvent(formatValue(date, TIME_FORMAT), name));

  return (
    <>
      <PickerField
        {...props}
        name={name}
        required={required}
        display={displayTime(selected)}
        icon={<ScheduleRoundedIcon fontSize="small" />}
        onOpen={picker.openAt}
        onClear={() => emit(null)}
        clearable={clearable}
      />
      <PickerSurface anchorEl={picker.anchorEl} open={picker.open} onClose={picker.close}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TimeColumns
            hour={selected ? selected.hour() : null}
            minute={selected ? selected.minute() : null}
            minuteStep={minuteStep}
            onChange={(hour, minute) => emit(dayjs().startOf('day').hour(hour).minute(minute))}
          />
        </div>
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
            { label: t('pickerNow'), onClick: () => emit(roundToStep(dayjs(), minuteStep)) },
          ]}
          primary={{ label: t('pickerDone'), onClick: picker.close }}
        />
      </PickerSurface>
    </>
  );
};

export default TimeField;

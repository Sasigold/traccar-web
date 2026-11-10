// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useState } from 'react';
import dayjs from 'dayjs';
import { makeStyles } from 'tss-react/mui';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { useTranslation } from '../LocalizationProvider';
import PickerField from './PickerField';
import PickerSurface from './PickerSurface';
import CalendarPanel from './CalendarPanel';
import TimeColumns from './TimeColumns';
import PickerFooter from './PickerFooter';
import usePickerState from './usePickerState';
import {
  DATE_TIME_FORMAT,
  changeEvent,
  displayDateTime,
  formatValue,
  parseValue,
  roundToStep,
} from './pickerUtils';

const useStyles = makeStyles()((theme) => ({
  body: {
    display: 'flex',
    alignItems: 'flex-start',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      alignItems: 'center',
    },
  },
  time: {
    borderInlineStart: `1px solid ${theme.palette.surface.border}`,
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      borderInlineStart: 'none',
      borderTop: `1px solid ${theme.palette.surface.border}`,
      width: '100%',
      justifyContent: 'center',
    },
  },
}));

// Date + time picker. Value and onChange use local 'YYYY-MM-DDTHH:mm' strings through a change
// event, like the native datetime-local input it replaces. Minutes step by 5 unless
// `minuteStep` says otherwise (1 for exact times).
const DateTimeField = ({
  value,
  onChange,
  name,
  min,
  max,
  minuteStep = 5,
  required,
  clearable = !required,
  // eslint-disable-next-line no-unused-vars
  type,
  ...props
}) => {
  const t = useTranslation();
  const { classes } = useStyles();
  const picker = usePickerState();
  const selected = parseValue(value);
  const minDate = parseValue(min);
  const maxDate = parseValue(max);
  const [month, setMonth] = useState(() => (selected || dayjs()).startOf('month'));

  const emit = (date) => onChange?.(changeEvent(formatValue(date, DATE_TIME_FORMAT), name));

  const open = (element) => {
    setMonth((selected || dayjs()).startOf('month'));
    picker.openAt(element);
  };

  const selectDay = (day) => {
    const time = selected || roundToStep(dayjs(), minuteStep);
    emit(day.hour(time.hour()).minute(time.minute()));
  };

  const selectTime = (hour, minute) => {
    const base = selected || dayjs();
    emit(base.hour(hour).minute(minute).second(0));
  };

  return (
    <>
      <PickerField
        {...props}
        name={name}
        required={required}
        display={displayDateTime(selected)}
        icon={<EventRoundedIcon fontSize="small" />}
        onOpen={open}
        onClear={() => emit(null)}
        clearable={clearable}
      />
      <PickerSurface anchorEl={picker.anchorEl} open={picker.open} onClose={picker.close}>
        <div className={classes.body}>
          <CalendarPanel
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            min={minDate}
            max={maxDate}
            onSelect={selectDay}
          />
          <div className={classes.time}>
            <TimeColumns
              hour={selected ? selected.hour() : null}
              minute={selected ? selected.minute() : null}
              minuteStep={minuteStep}
              onChange={selectTime}
            />
          </div>
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
            {
              label: t('pickerNow'),
              onClick: () => {
                const now = roundToStep(dayjs(), minuteStep);
                setMonth(now.startOf('month'));
                emit(now);
              },
            },
          ]}
          primary={{ label: t('pickerDone'), onClick: picker.close }}
        />
      </PickerSurface>
    </>
  );
};

export default DateTimeField;

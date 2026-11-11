// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useState } from 'react';
import dayjs from 'dayjs';
import { ButtonBase, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import { useTranslation } from '../LocalizationProvider';
import PickerField from './PickerField';
import PickerSurface from './PickerSurface';
import CalendarPanel from './CalendarPanel';
import TimeSelects from './TimeSelects';
import PickerFooter from './PickerFooter';
import usePickerState from './usePickerState';
import {
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  displayRange,
  formatValue,
  parseValue,
  sameDay,
} from './pickerUtils';

const useStyles = makeStyles()((theme) => ({
  layout: {
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  presets: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: theme.spacing(1),
    minWidth: 140,
    borderInlineEnd: `1px solid ${theme.palette.surface.border}`,
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      overflowX: 'auto',
      borderInlineEnd: 'none',
      borderBottom: `1px solid ${theme.palette.surface.border}`,
      gap: theme.spacing(0.75),
    },
  },
  preset: {
    justifyContent: 'flex-start',
    padding: theme.spacing(0.75, 1.25),
    borderRadius: theme.shape.borderRadius,
    ...theme.typography.body2,
    color: theme.palette.text.primary,
    textAlign: 'start',
    whiteSpace: 'nowrap',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.secondary.main}` },
    [theme.breakpoints.down('sm')]: {
      flexShrink: 0,
      border: `1px solid ${theme.palette.surface.border}`,
      borderRadius: 999,
    },
  },
  presetActive: {
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
    fontWeight: 600,
    '&:hover': { backgroundColor: theme.palette.surface.tint },
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
  },
  hint: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    padding: theme.spacing(1, 2, 0),
  },
  months: {
    display: 'flex',
    justifyContent: 'center',
  },
  times: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1, 3),
    padding: theme.spacing(1, 2, 1.5),
    borderTop: `1px solid ${theme.palette.surface.border}`,
  },
}));

const presetRanges = () => {
  const today = dayjs().startOf('day');
  return [
    { key: 'today', labelKey: 'reportToday', start: today, end: today },
    {
      key: 'yesterday',
      labelKey: 'reportYesterday',
      start: today.subtract(1, 'day'),
      end: today.subtract(1, 'day'),
    },
    { key: 'last7', labelKey: 'pickerLast7Days', start: today.subtract(6, 'day'), end: today },
    {
      key: 'week',
      labelKey: 'reportThisWeek',
      start: today.startOf('week'),
      end: today.endOf('week'),
    },
    {
      key: 'prevWeek',
      labelKey: 'reportPreviousWeek',
      start: today.subtract(1, 'week').startOf('week'),
      end: today.subtract(1, 'week').endOf('week'),
    },
    { key: 'last30', labelKey: 'pickerLast30Days', start: today.subtract(29, 'day'), end: today },
    {
      key: 'month',
      labelKey: 'reportThisMonth',
      start: today.startOf('month'),
      end: today.endOf('month'),
    },
    {
      key: 'prevMonth',
      labelKey: 'reportPreviousMonth',
      start: today.subtract(1, 'month').startOf('month'),
      end: today.subtract(1, 'month').endOf('month'),
    },
  ];
};

const withTime = (day, time) => day.hour(time.hour).minute(time.minute).second(0).millisecond(0);

// Date range picker: one field, a two-month calendar (one on phones) with quick presets, and
// optional start / end times. onChange(from, to) receives strings in the same formats the native
// inputs used: 'YYYY-MM-DD', or 'YYYY-MM-DDTHH:mm' with `withTime`.
const DateRangeField = ({
  from,
  to,
  onChange,
  withTime: timed = false,
  minuteStep = 5,
  presets = true,
  min,
  max,
  required,
  clearable = !required,
  ...props
}) => {
  const t = useTranslation();
  const theme = useTheme();
  const { classes, cx } = useStyles();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const picker = usePickerState();

  const start = parseValue(from);
  const end = parseValue(to);
  const minDate = parseValue(min);
  const maxDate = parseValue(max);

  const [draftStart, setDraftStart] = useState(null);
  const [draftEnd, setDraftEnd] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const [month, setMonth] = useState(() => (start || dayjs()).startOf('month'));
  const [startTime, setStartTime] = useState({ hour: 0, minute: 0 });
  const [endTime, setEndTime] = useState({ hour: 23, minute: 59 });

  const format = timed ? DATE_TIME_FORMAT : DATE_FORMAT;
  const display = displayRange(start, end, timed);

  const commit = (rangeStart, rangeEnd, times = {}) => {
    const s = times.start || startTime;
    const e = times.end || endTime;
    const fromValue = timed ? withTime(rangeStart, s) : rangeStart;
    const toValue = timed ? withTime(rangeEnd, e) : rangeEnd;
    onChange?.(formatValue(fromValue, format), formatValue(toValue, format), {
      from: fromValue,
      to: toValue,
    });
  };

  const open = (element) => {
    setDraftStart(start);
    setDraftEnd(end);
    setHoverDay(null);
    setStartTime(
      start && timed ? { hour: start.hour(), minute: start.minute() } : { hour: 0, minute: 0 },
    );
    setEndTime(
      end && timed ? { hour: end.hour(), minute: end.minute() } : { hour: 23, minute: 59 },
    );
    const anchor = (start || dayjs()).startOf('month');
    // Two months on desktop: keep the end month visible when the range spans months.
    setMonth(
      !phone && end && !end.isSame(anchor, 'month')
        ? end.startOf('month').subtract(1, 'month')
        : anchor,
    );
    picker.openAt(element);
  };

  const selectDay = (day) => {
    if (!draftStart || draftEnd || day.isBefore(draftStart, 'day')) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(day);
    commit(draftStart, day);
    if (!timed) picker.close();
  };

  const applyPreset = (preset) => {
    const times = { start: { hour: 0, minute: 0 }, end: { hour: 23, minute: 59 } };
    setDraftStart(preset.start);
    setDraftEnd(preset.end);
    setStartTime(times.start);
    setEndTime(times.end);
    commit(preset.start, preset.end, times);
    picker.close();
  };

  const changeTime = (which, hour, minute) => {
    const time = { hour, minute };
    if (which === 'start') setStartTime(time);
    else setEndTime(time);
    if (draftStart && draftEnd) commit(draftStart, draftEnd, { [which]: time });
  };

  const clear = () => onChange?.('', '', { from: null, to: null });

  const presetList = presets ? presetRanges() : [];
  const activePreset = presetList.find(
    (preset) => sameDay(preset.start, draftStart) && sameDay(preset.end, draftEnd),
  );

  const hint = !draftStart || draftEnd ? t('pickerSelectStart') : t('pickerSelectEnd');

  const calendarProps = {
    rangeStart: draftStart,
    rangeEnd: draftEnd,
    hoverDay: draftStart && !draftEnd ? hoverDay : null,
    onHoverDay: setHoverDay,
    onSelect: selectDay,
    min: minDate,
    max: maxDate,
  };

  return (
    <>
      <PickerField
        {...props}
        required={required}
        display={display}
        icon={<DateRangeRoundedIcon fontSize="small" />}
        onOpen={open}
        onClear={clear}
        clearable={clearable}
      />
      <PickerSurface anchorEl={picker.anchorEl} open={picker.open} onClose={picker.close}>
        <div className={classes.layout}>
          {presetList.length > 0 && (
            <div className={classes.presets}>
              {presetList.map((preset) => (
                <ButtonBase
                  key={preset.key}
                  className={cx(classes.preset, activePreset === preset && classes.presetActive)}
                  onClick={() => applyPreset(preset)}
                >
                  {t(preset.labelKey)}
                </ButtonBase>
              ))}
            </div>
          )}
          <div className={classes.main}>
            <Typography component="div" className={classes.hint}>
              {hint}
            </Typography>
            <div className={classes.months}>
              {phone ? (
                <CalendarPanel {...calendarProps} month={month} onMonthChange={setMonth} />
              ) : (
                <>
                  <CalendarPanel
                    {...calendarProps}
                    month={month}
                    onMonthChange={setMonth}
                    hideNext
                    allowViews={false}
                  />
                  <CalendarPanel
                    {...calendarProps}
                    month={month.add(1, 'month')}
                    onMonthChange={(value) => setMonth(value.subtract(1, 'month'))}
                    hidePrev
                    allowViews={false}
                  />
                </>
              )}
            </div>
            {timed && (
              <div className={classes.times}>
                <TimeSelects
                  label={t('pickerStartTime')}
                  hour={startTime.hour}
                  minute={startTime.minute}
                  minuteStep={minuteStep}
                  onChange={(hour, minute) => changeTime('start', hour, minute)}
                />
                <TimeSelects
                  label={t('pickerEndTime')}
                  hour={endTime.hour}
                  minute={endTime.minute}
                  minuteStep={minuteStep}
                  onChange={(hour, minute) => changeTime('end', hour, minute)}
                />
              </div>
            )}
          </div>
        </div>
        <PickerFooter
          actions={[
            clearable && {
              label: t('pickerClear'),
              onClick: () => {
                clear();
                picker.close();
              },
              disabled: !start && !end,
            },
          ]}
          primary={{
            label: t('pickerDone'),
            onClick: picker.close,
            disabled: Boolean(draftStart && !draftEnd),
          }}
        />
      </PickerSurface>
    </>
  );
};

export default DateRangeField;

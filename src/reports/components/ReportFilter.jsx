import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';
import SplitButton from '../../common/components/SplitButton';
import SelectField from '../../common/components/SelectField';
import { useRestriction } from '../../common/util/permissions';
import { deviceEquality } from '../../common/util/deviceEquality';
import { reportsActions } from '../../store';
import ReportIntro from './ReportIntro';
import { getFormatLocale } from '../../common/util/formatter';
import { DateRangeField } from '../../common/components/pickers';
import { PERIODS, periodRange, shiftRange } from '../../dashboard/data/periods';
import { PERIOD_KEYS } from '../../dashboard/components/periodLabel';
import { NextPeriodIcon, PreviousPeriodIcon } from '../../common/components/PeriodArrowIcons';

// The same presets as the dashboard. Older saved choices ("day", "week", "month") still work.
const LEGACY_PERIODS = { day: 'today', week: 'thisWeek', month: 'thisMonth' };
const normalizePeriod = (period) => {
  const value = LEGACY_PERIODS[period] || period;
  return PERIODS.includes(value) ? value : 'today';
};

// A new custom period starts with today, from midnight until now.
const getPeriodRange = (period) => {
  if (period === 'custom') {
    return [dayjs().startOf('day').toISOString(), dayjs().toISOString()];
  }
  const { from, to } = periodRange(period);
  return [from.toISOString(), to.toISOString()];
};

export const updateReportParams = (searchParams, setSearchParams, key, values) => {
  const newParams = new URLSearchParams(searchParams);
  newParams.delete(key);
  newParams.delete('from');
  newParams.delete('to');
  values.forEach((value) => newParams.append(key, value));
  setSearchParams(newParams, { replace: true });
};

const ReportFilter = ({ children, onShow, onExport, onSchedule, deviceType, loading, formats }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const dispatch = useDispatch();

  const [searchParams, setSearchParams] = useSearchParams();

  const readonly = useRestriction('readonly');

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));
  const groups = useSelector((state) => state.groups.items);
  const savedPeriod = useSelector((state) => state.reports.period);
  const savedRange = useSelector((state) => state.reports.range);
  const deviceList = useMemo(
    () => [
      { id: 'all', name: t('notificationAlways') },
      ...Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    ],
    [devices, t],
  );
  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const deviceIds = useMemo(
    () => searchParams.getAll('deviceId').map((it) => (it === 'all' ? it : Number(it))),
    [searchParams],
  );
  const groupIds = useMemo(() => searchParams.getAll('groupId').map(Number), [searchParams]);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [period, setPeriod] = useState(() =>
    normalizePeriod(searchParams.get('period') || (from && to ? 'custom' : savedPeriod)),
  );
  const [range, setRange] = useState(() =>
    from && to
      ? [from, to]
      : (searchParams.has('period') ? null : savedRange) || getPeriodRange(period),
  );
  const [selectedOption, setSelectedOption] = useState('json');

  // The address can change the period from outside the filter (for example "the last 30 days"
  // in an empty report); the shown period follows it.
  const urlPeriod = searchParams.get('period');
  useEffect(() => {
    if (from && to) {
      setRange([from, to]);
      setPeriod(normalizePeriod(urlPeriod || 'custom'));
    }
  }, [from, to, urlPeriod]);

  const [description, setDescription] = useState();
  const [calendarId, setCalendarId] = useState();

  const selectedFrom = dayjs(range[0]);
  const selectedTo = dayjs(range[1]);
  const validRange =
    selectedFrom.isValid() && selectedTo.isValid() && selectedTo.isAfter(selectedFrom);

  const evaluateDisabled = () => {
    if (deviceType === 'single' && !deviceIds.length) {
      return true;
    }
    if (deviceType === 'multiple' && !deviceIds.length && !groupIds.length) {
      return true;
    }
    if (selectedOption === 'schedule' && (!description || !calendarId)) {
      return true;
    }
    return loading || (selectedOption !== 'schedule' && !validRange);
  };
  const disabled = evaluateDisabled();
  const loaded = from && to && !loading;

  const evaluateOptions = () => {
    const result = {
      json: t('reportShow'),
    };
    if (onExport && loaded) {
      formats.forEach((format) => {
        result[format] = `${t('reportExport')} (${format.toUpperCase()})`;
      });
      result.print = t('reportPrint');
    }
    if (onSchedule && !readonly) {
      result.schedule = t('reportSchedule');
    }
    return result;
  };
  const options = evaluateOptions();

  useEffect(() => {
    if (from && to) {
      onShow({ deviceIds: deviceIds.filter((it) => it !== 'all'), groupIds, from, to });
    }
  }, [deviceIds, groupIds, from, to, onShow]);

  const dateFormat = new Intl.DateTimeFormat(getFormatLocale(), {
    year: 'numeric',
    month: period.endsWith('Month') ? 'long' : 'short',
    day: period.endsWith('Month') ? undefined : 'numeric',
  });
  const periodLabel =
    period === 'custom' || !validRange
      ? t('reportCustom')
      : dateFormat.formatRange(selectedFrom.toDate(), selectedTo.toDate());

  const showReport = () => {
    dispatch(reportsActions.updatePeriod({ period, range }));
    const newParams = new URLSearchParams(searchParams);
    newParams.set('period', period);
    newParams.set('from', selectedFrom.toISOString());
    newParams.set('to', selectedTo.toISOString());
    setSearchParams(newParams, { replace: true });
  };

  // The arrows move by whole periods (a month stays a whole month); a custom period moves by its
  // own length. Nothing after now.
  const shifted = (direction) =>
    shiftRange(period, { from: selectedFrom, to: selectedTo }, direction);
  const shiftPeriod = (direction) => {
    const { from: start, to: end } = shifted(direction);
    setRange([start.toISOString(), end.toISOString()]);
  };
  const nextInFuture = validRange && shifted(1).from.isAfter(dayjs());

  const onSelected = (type) => {
    switch (type) {
      case 'xlsx':
      case 'csv':
      case 'gpx':
      case 'kml':
      case 'kmz':
        onExport({
          deviceIds: deviceIds.filter((it) => it !== 'all'),
          groupIds,
          from,
          to,
          format: type,
        });
        break;
      case 'print':
        window.print();
        break;
      default:
        setSelectedOption(type);
        break;
    }
  };

  const onClick = (type) => {
    switch (type) {
      case 'schedule':
        onSchedule(
          deviceIds.filter((it) => it !== 'all'),
          groupIds,
          {
            description,
            calendarId,
            attributes: {},
          },
        );
        break;
      case 'json':
      default:
        showReport();
        break;
    }
  };

  let hint = null;
  if (selectedOption === 'schedule') {
    hint = t('reportScheduleHint');
  } else if (deviceType === 'multiple') {
    hint = t('reportFilterHint');
  } else if (deviceType === 'single') {
    hint = t('reportFilterHintSingle');
  }

  return (
    <div className={classes.filter}>
      <ReportIntro hint={hint} />
      {deviceType !== 'none' && (
        <div className={classes.filterItem}>
          <SelectField
            label={t(deviceType === 'multiple' ? 'deviceTitle' : 'reportDevice')}
            data={
              deviceType === 'multiple' ? deviceList : deviceList.filter((it) => it.id !== 'all')
            }
            value={deviceType === 'multiple' ? deviceIds : deviceIds.find(() => true)}
            allValue="all"
            onChange={(e) => {
              const values =
                deviceType === 'multiple' ? e.target.value : [e.target.value].filter((id) => id);
              updateReportParams(searchParams, setSearchParams, 'deviceId', values);
            }}
            multiple={deviceType === 'multiple'}
            singleLine={deviceType === 'multiple'}
            fullWidth
          />
        </div>
      )}
      {deviceType === 'multiple' && (
        <div className={classes.filterItem}>
          <SelectField
            label={t('settingsGroups')}
            data={groupList}
            value={groupIds}
            onChange={(e) => {
              const values = e.target.value;
              updateReportParams(searchParams, setSearchParams, 'groupId', values);
            }}
            multiple
            singleLine
            fullWidth
          />
        </div>
      )}
      {selectedOption !== 'schedule' ? (
        <>
          <div className={classes.filterItem} style={{ flexBasis: 220 }}>
            <FormControl fullWidth>
              <InputLabel id="report-filter-report-period-label" shrink>
                {t('reportPeriod')}
              </InputLabel>
              <Select
                labelId="report-filter-report-period-label"
                label={t('reportPeriod')}
                value=""
                displayEmpty
                renderValue={() => periodLabel}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  if (e.target.value !== 'custom') {
                    setRange(getPeriodRange(e.target.value));
                  }
                }}
                startAdornment={
                  <InputAdornment position="start">
                    <IconButton
                      edge="start"
                      size="small"
                      disabled={loading || !validRange}
                      onClick={() => shiftPeriod(-1)}
                      aria-label={t('a11yPreviousPeriod')}
                    >
                      <PreviousPeriodIcon />
                    </IconButton>
                  </InputAdornment>
                }
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      disabled={loading || !validRange || nextInFuture}
                      onClick={() => shiftPeriod(1)}
                      aria-label={t('a11yNextPeriod')}
                    >
                      <NextPeriodIcon />
                    </IconButton>
                  </InputAdornment>
                }
              >
                {PERIODS.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(PERIOD_KEYS[value])}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          {period === 'custom' && (
            <div className={classes.filterItem} style={{ flexGrow: 2 }}>
              <DateRangeField
                withTime
                label={t('reportPeriod')}
                from={
                  range[0] && selectedFrom.isValid()
                    ? selectedFrom.locale('en').format('YYYY-MM-DDTHH:mm')
                    : ''
                }
                to={
                  range[1] && selectedTo.isValid()
                    ? selectedTo.locale('en').format('YYYY-MM-DDTHH:mm')
                    : ''
                }
                onChange={(_from, _to, { from: start, to: end }) =>
                  setRange([
                    start ? start.toISOString() : '',
                    end ? end.endOf('minute').toISOString() : '',
                  ])
                }
                fullWidth
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className={classes.filterItem}>
            <TextField
              value={description || ''}
              onChange={(event) => setDescription(event.target.value)}
              label={t('sharedDescription')}
              helperText={t('reportScheduleNameHelp')}
              fullWidth
            />
          </div>
          <div className={classes.filterItem}>
            <SelectField
              value={calendarId}
              onChange={(event) => setCalendarId(Number(event.target.value))}
              endpoint="api/calendars"
              label={t('sharedCalendar')}
              helperText={t('reportScheduleCalendarHelp')}
              fullWidth
            />
          </div>
        </>
      )}
      {children}
      <div className={classes.filterItem}>
        {Object.keys(options).length === 1 ? (
          <Button
            fullWidth
            variant="contained"
            color="primary"
            disabled={disabled}
            onClick={onClick}
          >
            <Typography variant="button" noWrap>
              {t(loading ? 'sharedLoading' : 'reportShow')}
            </Typography>
          </Button>
        ) : (
          <SplitButton
            fullWidth
            variant="contained"
            color="primary"
            disabled={disabled}
            onClick={onClick}
            selected={selectedOption}
            setSelected={onSelected}
            options={options}
          />
        )}
      </div>
    </div>
  );
};

export default ReportFilter;

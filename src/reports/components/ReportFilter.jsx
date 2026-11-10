import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';
import SplitButton from '../../common/components/SplitButton';
import ScheduleDialog from './ScheduleDialog';
import { useReportsSectionItems } from './reportsSections';
import VehiclePicker from '../../common/components/vehiclePicker/VehiclePicker';
import { useRestriction } from '../../common/util/permissions';
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
  const location = useLocation();
  const reportName = useReportsSectionItems().find((item) =>
    item.match(location.pathname),
  )?.titleKey;
  const { classes } = useReportStyles();
  const t = useTranslation();
  const dispatch = useDispatch();

  const [searchParams, setSearchParams] = useSearchParams();

  const readonly = useRestriction('readonly');

  const savedPeriod = useSelector((state) => state.reports.period);
  const savedRange = useSelector((state) => state.reports.range);
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

  const [scheduling, setScheduling] = useState(false);

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
    return loading || !validRange;
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
    return result;
  };
  const options = evaluateOptions();

  // REP-10: what the results on screen were made for. Once the filter no longer says that (other
  // vehicles, or a period not applied yet), the results dim and a bar offers to update them.
  const [shownFor, setShownFor] = useState(null);
  useEffect(() => {
    if (from && to) {
      onShow({ deviceIds: deviceIds.filter((it) => it !== 'all'), groupIds, from, to });
      setShownFor({ from, to });
    }
  }, [deviceIds, groupIds, from, to, onShow]);
  const stale = Boolean(
    shownFor &&
    (!from || !to || !dayjs(range[0]).isSame(dayjs(from)) || !dayjs(range[1]).isSame(dayjs(to))),
  );
  const rootRef = useRef(null);
  useEffect(() => {
    const header = rootRef.current?.parentElement;
    if (!header) return undefined;
    header.dataset.stale = String(stale);
    return () => {
      delete header.dataset.stale;
    };
  }, [stale]);

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
      case 'json':
      default:
        showReport();
        break;
    }
  };

  let hint = null;
  if (deviceType === 'multiple') {
    hint = t('reportFilterHint');
  } else if (deviceType === 'single') {
    hint = t('reportFilterHintSingle');
  }

  return (
    <div className={classes.filter} ref={rootRef}>
      <ReportIntro hint={hint} />
      {deviceType !== 'none' && (
        <div className={classes.filterItem} style={{ flexBasis: 260 }}>
          {/* REP-05: one picker for vehicles and groups, with search by plate. */}
          <VehiclePicker
            label={t(deviceType === 'multiple' ? 'deviceTitle' : 'reportDevice')}
            multiple={deviceType === 'multiple'}
            value={{ deviceIds, groupIds: deviceType === 'multiple' ? groupIds : [] }}
            onChange={(selection) => {
              const newParams = new URLSearchParams(searchParams);
              ['deviceId', 'groupId', 'from', 'to'].forEach((key) => newParams.delete(key));
              selection.deviceIds.forEach((id) => newParams.append('deviceId', id));
              selection.groupIds.forEach((id) => newParams.append('groupId', id));
              setSearchParams(newParams, { replace: true });
            }}
          />
        </div>
      )}
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
      {onSchedule && !readonly && (
        <div className={classes.filterItem}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<EventRepeatRoundedIcon />}
            disabled={!deviceIds.filter((it) => it !== 'all').length && !groupIds.length}
            onClick={() => setScheduling(true)}
          >
            {t('reportScheduleButton')}
          </Button>
        </div>
      )}
      {stale && (
        <div className={classes.staleBar} role="status">
          <Typography variant="body2">{t('reportFilterChanged')}</Typography>
          <Button size="small" variant="outlined" onClick={showReport} disabled={disabled}>
            {t('reportUpdate')}
          </Button>
        </div>
      )}
      {scheduling && (
        <ScheduleDialog
          title={t('reportScheduleButton')}
          defaultName={reportName ? t(reportName) : ''}
          onClose={() => setScheduling(false)}
          onSave={async (schedule) => {
            await onSchedule(
              deviceIds.filter((it) => it !== 'all'),
              groupIds,
              schedule,
            );
            setScheduling(false);
          }}
        />
      )}
    </div>
  );
};

export default ReportFilter;

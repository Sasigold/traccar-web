import dayjs from 'dayjs';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import TextField from '@mui/material/TextField';
import { FormControl, FormHelperText, InputLabel, Select, MenuItem } from '@mui/material';
import FileInput from '../common/components/FileInput';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { prefixString } from '../common/util/stringUtils';
import { calendarsActions } from '../store';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import { DateTimeField } from '../common/components/pickers';

const formatCalendarTime = (time) => {
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `TZID=${tzid}:${time.locale('en').format('YYYYMMDDTHHmmss')}`;
};

const parseRule = (rule) => {
  if (rule.endsWith('COUNT=1')) {
    return { frequency: 'ONCE' };
  }
  const fragments = rule.split(';');
  const frequency = fragments[0].substring(11);
  const by = fragments.length > 1 ? fragments[1].split('=')[1].split(',') : null;
  return { frequency, by };
};

const formatRule = (rule) => {
  const by = rule.by && rule.by.join(',');
  switch (rule.frequency) {
    case 'DAILY':
      return `RRULE:FREQ=${rule.frequency}`;
    case 'WEEKLY':
      return `RRULE:FREQ=${rule.frequency};BYDAY=${by || 'SU'}`;
    case 'MONTHLY':
      return `RRULE:FREQ=${rule.frequency};BYMONTHDAY=${by || 1}`;
    default:
      return 'RRULE:FREQ=DAILY;COUNT=1';
  }
};

const updateCalendar = (lines, index, element) =>
  window.btoa(lines.map((e, i) => (i !== index ? e : element)).join('\n'));

const simpleCalendar = () =>
  window.btoa(
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Traccar//NONSGML Traccar//EN',
      'BEGIN:VEVENT',
      'UID:00000000-0000-0000-0000-000000000000',
      `DTSTART;${formatCalendarTime(dayjs())}`,
      `DTEND;${formatCalendarTime(dayjs().add(1, 'hours'))}`,
      'RRULE:FREQ=DAILY',
      'SUMMARY:Event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n'),
  );

const CalendarPage = () => {
  const dispatch = useDispatch();
  const t = useTranslation();

  const [item, setItem] = useState();
  const [file, setFile] = useState(null);

  const decoded = item && item.data && window.atob(item.data);

  const simple = decoded && decoded.indexOf('//Traccar//') > 0;

  const lines = decoded && decoded.split('\n');

  const rule = simple && parseRule(lines[7]);

  const handleFileChange = (newFile) => {
    setFile(newFile);
    if (newFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const { result } = event.target;
        setItem({ ...item, data: result.slice(result.indexOf(',') + 1) });
      };
      reader.readAsDataURL(newFile);
    }
  };

  const onItemSaved = useCatch(async () => {
    const response = await fetchOrThrow('api/calendars');
    dispatch(calendarsActions.refresh(await response.json()));
  });

  const validate = () => item && item.name && item.data;

  return (
    <EditItemView
      endpoint="calendars"
      item={item}
      setItem={setItem}
      defaultItem={{ data: simpleCalendar() }}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedCalendar']}
      description={t('calendarPageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
            />
            <FormControl>
              <InputLabel id="calendar-page-shared-type-label">{t('sharedType')}</InputLabel>
              <Select
                labelId="calendar-page-shared-type-label"
                label={t('sharedType')}
                value={simple ? 'simple' : 'custom'}
                onChange={(e) =>
                  setItem({
                    ...item,
                    data: e.target.value === 'simple' ? simpleCalendar() : null,
                  })
                }
              >
                <MenuItem value="simple">{t('calendarSimple')}</MenuItem>
                <MenuItem value="custom">{t('reportCustom')}</MenuItem>
              </Select>
              <FormHelperText>{t('calendarTypeHelp')}</FormHelperText>
            </FormControl>
            {simple ? (
              <>
                <DateTimeField
                  clearable={false}
                  label={t('reportFrom')}
                  value={dayjs(lines[5].slice(-15)).locale('en').format('YYYY-MM-DDTHH:mm')}
                  onChange={(e) => {
                    const time = formatCalendarTime(dayjs(e.target.value, 'YYYY-MM-DDTHH:mm'));
                    setItem({ ...item, data: updateCalendar(lines, 5, `DTSTART;${time}`) });
                  }}
                  helperText={t('calendarRangeHelp')}
                />
                <DateTimeField
                  clearable={false}
                  label={t('reportTo')}
                  value={dayjs(lines[6].slice(-15)).locale('en').format('YYYY-MM-DDTHH:mm')}
                  onChange={(e) => {
                    const time = formatCalendarTime(dayjs(e.target.value, 'YYYY-MM-DDTHH:mm'));
                    setItem({ ...item, data: updateCalendar(lines, 6, `DTEND;${time}`) });
                  }}
                />
                <FormControl>
                  <InputLabel id="calendar-page-calendar-recurrence-label">
                    {t('calendarRecurrence')}
                  </InputLabel>
                  <Select
                    labelId="calendar-page-calendar-recurrence-label"
                    label={t('calendarRecurrence')}
                    value={rule.frequency}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        data: updateCalendar(lines, 7, formatRule({ frequency: e.target.value })),
                      })
                    }
                  >
                    {['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'].map((it) => (
                      <MenuItem key={it} value={it}>
                        {t(prefixString('calendar', it.toLowerCase()))}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{t('calendarRecurrenceHelp')}</FormHelperText>
                </FormControl>
                {['WEEKLY', 'MONTHLY'].includes(rule.frequency) && (
                  <FormControl>
                    <InputLabel id="calendar-page-calendar-days-label">
                      {t('calendarDays')}
                    </InputLabel>
                    <Select
                      labelId="calendar-page-calendar-days-label"
                      multiple
                      label={t('calendarDays')}
                      value={rule.by}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          data: updateCalendar(
                            lines,
                            7,
                            formatRule({ ...rule, by: e.target.value }),
                          ),
                        })
                      }
                    >
                      {rule.frequency === 'WEEKLY'
                        ? [
                            'sunday',
                            'monday',
                            'tuesday',
                            'wednesday',
                            'thursday',
                            'friday',
                            'saturday',
                          ].map((it) => (
                            <MenuItem key={it} value={it.substring(0, 2).toUpperCase()}>
                              {t(prefixString('calendar', it))}
                            </MenuItem>
                          ))
                        : Array.from({ length: 31 }, (_, i) => i + 1).map((it) => (
                            <MenuItem key={it} value={String(it)}>
                              {it}
                            </MenuItem>
                          ))}
                    </Select>
                  </FormControl>
                )}
              </>
            ) : (
              <FileInput
                placeholder={t('sharedSelectFile')}
                value={file}
                onChange={handleFileChange}
              />
            )}
          </FormSection>
          <EditAttributesAccordion
            attributes={item.attributes}
            setAttributes={(attributes) => setItem({ ...item, attributes })}
            definitions={{}}
          />
        </>
      )}
    </EditItemView>
  );
};

export default CalendarPage;

import { useState } from 'react';
import dayjs from 'dayjs';
import {
  Chip,
  Stack,
  Typography,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import useAttributeUnits from '../common/util/useAttributeUnits';
import {
  attributeFromRaw,
  attributeToRaw,
  attributeUnitString,
} from '../common/util/attributeUnits';
import { useTranslation } from '../common/components/LocalizationProvider';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import SettingsMenu from './components/SettingsMenu';
import { DateField } from '../common/components/pickers';
import FormSection from './components/FormSection';

const DAY = 86400000;
const KM = 1000;
const HOUR = 3600000;

// ADM-31: the common plans, ready to fill in a new maintenance. Traccar keeps distances in
// meters, engine hours in milliseconds and dates as times; a yearly plan starts today, and the
// others are due first after one interval.
export const MAINTENANCE_TEMPLATES = [
  {
    key: 'service10k',
    nameKey: 'maintenanceTemplate10k',
    type: 'totalDistance',
    period: 10000 * KM,
  },
  {
    key: 'service15k',
    nameKey: 'maintenanceTemplate15k',
    type: 'totalDistance',
    period: 15000 * KM,
  },
  { key: 'yearly', nameKey: 'maintenanceTemplateYearly', type: 'fixTime', period: 365 * DAY },
  { key: 'hours250', nameKey: 'maintenanceTemplateHours', type: 'hours', period: 250 * HOUR },
  {
    key: 'brakes',
    nameKey: 'maintenanceTemplateBrakes',
    type: 'totalDistance',
    period: 30000 * KM,
  },
];

const MaintenancePage = () => {
  const t = useTranslation();

  const positionAttributes = usePositionAttributes(t);

  const [item, setItem] = useState();
  const units = useAttributeUnits();

  const convertToList = (attributes) => {
    const otherList = [];
    Object.keys(attributes).forEach((key) => {
      const value = attributes[key];
      if (value.type === 'number' || key.endsWith('Time')) {
        otherList.push({ key, name: value.name, type: value.type });
      }
    });
    return otherList;
  };

  const unit = attributeUnitString(positionAttributes[item?.type]?.dataType, units, t);
  const labels = item?.type?.endsWith('Time')
    ? { start: null, period: t('sharedDays') }
    : { start: unit, period: unit };

  const rawToValue = (start, value) => {
    const attribute = positionAttributes[item.type];
    if (item.type?.endsWith('Time')) {
      if (start) {
        return dayjs(value).locale('en').format('YYYY-MM-DD');
      }
      return value / 86400000;
    }
    return attributeFromRaw(value, attribute?.dataType, units);
  };

  const valueToRaw = (start, value) => {
    const attribute = positionAttributes[item.type];
    if (item.type?.endsWith('Time')) {
      if (start) {
        return dayjs(value, 'YYYY-MM-DD').valueOf();
      }
      return value * 86400000;
    }
    return attributeToRaw(value, attribute?.dataType, units);
  };

  const validate = () => item && item.name && item.type && item.start && item.period;

  return (
    <EditItemView
      endpoint="maintenance"
      item={item}
      setItem={setItem}
      validate={validate}
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'sharedMaintenance']}
      description={t('maintenancePageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            {!item.id && (
              <Stack spacing={1}>
                <Typography variant="body2" color="textSecondary">
                  {t('maintenanceTemplates')}
                </Typography>
                <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {MAINTENANCE_TEMPLATES.map((template) => (
                    <Chip
                      key={template.key}
                      label={t(template.nameKey)}
                      variant="outlined"
                      onClick={() =>
                        setItem({
                          ...item,
                          name: t(template.nameKey),
                          type: template.type,
                          // The first service one interval in (the same plan as from zero).
                          start: template.type.endsWith('Time')
                            ? dayjs().startOf('day').valueOf()
                            : template.period,
                          period: template.period,
                        })
                      }
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            <TextField
              value={item.name || ''}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
              label={t('sharedName')}
            />
            <FormControl>
              <InputLabel id="maintenance-page-shared-type-label">
                {t('maintenanceTypeLabel')}
              </InputLabel>
              <Select
                labelId="maintenance-page-shared-type-label"
                label={t('maintenanceTypeLabel')}
                value={item.type || ''}
                onChange={(e) => setItem({ ...item, type: e.target.value, start: 0, period: 0 })}
              >
                {convertToList(positionAttributes).map(({ key, name }) => (
                  <MenuItem key={key} value={key}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{t('maintenanceTypeHelp')}</FormHelperText>
            </FormControl>
            {item.type?.endsWith('Time') ? (
              <DateField
                value={rawToValue(true, item.start) || ''}
                onChange={(e) => setItem({ ...item, start: valueToRaw(true, e.target.value) })}
                label={
                  labels.start
                    ? `${t('maintenanceStart')} (${labels.start})`
                    : t('maintenanceStart')
                }
                helperText={t('maintenanceStartHelp')}
                clearable={false}
              />
            ) : (
              <TextField
                type="number"
                value={rawToValue(true, item.start) || ''}
                onChange={(e) => setItem({ ...item, start: valueToRaw(true, e.target.value) })}
                label={
                  labels.start
                    ? `${t('maintenanceStart')} (${labels.start})`
                    : t('maintenanceStart')
                }
                helperText={t('maintenanceStartHelp')}
              />
            )}
            <TextField
              type="number"
              value={rawToValue(false, item.period) || ''}
              onChange={(e) => setItem({ ...item, period: valueToRaw(false, e.target.value) })}
              label={
                labels.period
                  ? `${t('maintenancePeriod')} (${labels.period})`
                  : t('maintenancePeriod')
              }
              helperText={t('maintenancePeriodHelp')}
            />
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

export default MaintenancePage;

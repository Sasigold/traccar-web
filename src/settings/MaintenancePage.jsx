import { useState } from 'react';
import dayjs from 'dayjs';
import {
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
import FormSection from './components/FormSection';

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
      breadcrumbs={['settingsTitle', 'sharedMaintenance']}
      description={t('maintenancePageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
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
            <TextField
              type={item.type?.endsWith('Time') ? 'date' : 'number'}
              value={rawToValue(true, item.start) || ''}
              onChange={(e) => setItem({ ...item, start: valueToRaw(true, e.target.value) })}
              label={
                labels.start ? `${t('maintenanceStart')} (${labels.start})` : t('maintenanceStart')
              }
              helperText={t('maintenanceStartHelp')}
            />
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

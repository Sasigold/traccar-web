import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { messagesActions } from '../store';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  createFilterOptions,
  Autocomplete,
  Button,
} from '@mui/material';
import EditItemView from './components/EditItemView';
import { useTranslation } from '../common/components/LocalizationProvider';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import SettingsMenu from './components/SettingsMenu';
import SelectField from '../common/components/SelectField';
import { useCatch } from '../reactHelper';
import { snackBarDurationLongMs } from '../common/util/duration';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';

const allowedProperties = [
  'valid',
  'latitude',
  'longitude',
  'altitude',
  'speed',
  'course',
  'address',
  'accuracy',
];

const ComputedAttributePage = () => {
  const t = useTranslation();
  const dispatch = useDispatch();

  const positionAttributes = usePositionAttributes(t);

  const [item, setItem] = useState();
  const [deviceId, setDeviceId] = useState();

  const options = Object.entries(positionAttributes)
    .filter(([key, value]) => !value.property || allowedProperties.includes(key))
    .map(([key, value]) => ({
      key,
      name: value.name,
      type: value.type,
    }));

  const filter = createFilterOptions({
    stringify: (option) => option.name,
  });

  const testAttribute = useCatch(async () => {
    const query = new URLSearchParams({ deviceId });
    const url = `api/attributes/computed/test?${query.toString()}`;
    const response = await fetchOrThrow(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const result = await response.text();
    if (result) {
      dispatch(
        messagesActions.push({
          message: result,
          severity: 'info',
          duration: snackBarDurationLongMs,
        }),
      );
    }
  });

  const validate = () => item && item.description && item.expression;

  return (
    <EditItemView
      endpoint="attributes/computed"
      item={item}
      setItem={setItem}
      validate={validate}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedComputedAttribute']}
      description={t('computedAttributePageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.description || ''}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
              label={t('sharedDescription')}
            />
            <Autocomplete
              freeSolo
              value={
                options.find((option) => option.key === item.attribute) || item.attribute || null
              }
              onChange={(_, option) => {
                const attribute = option ? option.key || option.inputValue || option : null;
                if (option && (option.type || option.inputValue)) {
                  setItem({ ...item, attribute, type: option.type });
                } else {
                  setItem({ ...item, attribute });
                }
              }}
              filterOptions={(options, params) => {
                const filtered = filter(options, params);
                if (
                  params.inputValue &&
                  !options.some((x) => (typeof x === 'object' ? x.key : x) === params.inputValue)
                ) {
                  filtered.push({
                    inputValue: params.inputValue,
                    name: `${t('sharedAdd')} "${params.inputValue}"`,
                  });
                }
                return filtered;
              }}
              options={options}
              getOptionLabel={(option) =>
                typeof option === 'object' ? option.inputValue || option.name : option
              }
              renderOption={(props, option) => <li {...props}>{option.name || option}</li>}
              renderInput={(params) => <TextField {...params} label={t('sharedAttribute')} />}
            />
            <TextField
              value={item.expression || ''}
              onChange={(e) => setItem({ ...item, expression: e.target.value })}
              label={t('sharedExpression')}
              multiline
              rows={4}
            />
            <FormControl disabled={item.attribute in positionAttributes}>
              <InputLabel id="computed-attribute-page-shared-type-label">
                {t('sharedType')}
              </InputLabel>
              <Select
                labelId="computed-attribute-page-shared-type-label"
                label={t('sharedType')}
                value={item.type || ''}
                onChange={(e) => setItem({ ...item, type: e.target.value })}
              >
                <MenuItem value="string">{t('sharedTypeString')}</MenuItem>
                <MenuItem value="number">{t('sharedTypeNumber')}</MenuItem>
                <MenuItem value="boolean">{t('sharedTypeBoolean')}</MenuItem>
              </Select>
            </FormControl>
          </FormSection>
          <FormSection title={t('formSectionMore')}>
            <TextField
              type="number"
              value={item.priority || 0}
              onChange={(e) => setItem({ ...item, priority: Number(e.target.value) })}
              label={t('sharedPriority')}
            />
          </FormSection>
          <FormSection title={t('sharedTest')}>
            <SelectField
              value={deviceId}
              onChange={(e) => setDeviceId(Number(e.target.value))}
              endpoint="api/devices"
              label={t('sharedDevice')}
            />
            <Button variant="outlined" color="primary" onClick={testAttribute} disabled={!deviceId}>
              {t('sharedTestExpression')}
            </Button>
          </FormSection>
        </>
      )}
    </EditItemView>
  );
};

export default ComputedAttributePage;

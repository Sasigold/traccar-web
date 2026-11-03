import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { TextField, FormControlLabel, Checkbox } from '@mui/material';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import useGeofenceAttributes from '../common/attributes/useGeofenceAttributes';
import SettingsMenu from './components/SettingsMenu';
import SelectField from '../common/components/SelectField';
import { geofencesActions } from '../store';
import FormSection from './components/FormSection';

const GeofencePage = () => {
  const dispatch = useDispatch();
  const t = useTranslation();

  const geofenceAttributes = useGeofenceAttributes(t);

  const [item, setItem] = useState();

  const onItemSaved = (result) => {
    dispatch(geofencesActions.update([result]));
  };

  const validate = () => item && item.name;

  return (
    <EditItemView
      endpoint="geofences"
      item={item}
      setItem={setItem}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedGeofence']}
    >
      {item && (
        <>
          <FormSection title={t('sharedRequired')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
            />
          </FormSection>
          <FormSection title={t('sharedExtra')}>
            <TextField
              value={item.description || ''}
              onChange={(event) => setItem({ ...item, description: event.target.value })}
              label={t('sharedDescription')}
            />
            <SelectField
              value={item.calendarId}
              onChange={(event) => setItem({ ...item, calendarId: Number(event.target.value) })}
              endpoint="api/calendars"
              label={t('sharedCalendar')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={item.attributes.hide}
                  onChange={(e) =>
                    setItem({
                      ...item,
                      attributes: { ...item.attributes, hide: e.target.checked },
                    })
                  }
                />
              }
              label={t('sharedFilterMap')}
            />
          </FormSection>
          <EditAttributesAccordion
            attributes={item.attributes}
            setAttributes={(attributes) => setItem({ ...item, attributes })}
            definitions={geofenceAttributes}
          />
        </>
      )}
    </EditItemView>
  );
};

export default GeofencePage;

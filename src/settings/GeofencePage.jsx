import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useDispatch } from 'react-redux';
import { TextField } from '@mui/material';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import useGeofenceAttributes from '../common/attributes/useGeofenceAttributes';
import SettingsMenu from './components/SettingsMenu';
import SelectField from '../common/components/SelectField';
import { geofencesActions } from '../store';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';

const GeofencePage = () => {
  const dispatch = useDispatch();
  const t = useTranslation();

  const geofenceAttributes = useGeofenceAttributes(t);

  const [item, setItem] = useState();

  // LIV-14: "create a geofence" from a vehicle's card opens a draft circle around it; it is
  // created, and linked to the vehicle, only when saved.
  const [searchParams] = useSearchParams();
  const draftLatitude = searchParams.get('latitude');
  const draftLongitude = searchParams.get('longitude');
  const draftDevice = Number(searchParams.get('deviceId')) || null;
  const defaultItem = useMemo(
    () =>
      draftLatitude && draftLongitude
        ? {
            name: '',
            area: `CIRCLE (${Number(draftLatitude)} ${Number(draftLongitude)}, 50)`,
            attributes: {},
          }
        : { attributes: {} },
    [draftLatitude, draftLongitude],
  );

  const onItemSaved = async (result) => {
    dispatch(geofencesActions.update([result]));
    if (draftDevice) {
      await fetchOrThrow('api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: draftDevice, geofenceId: result.id }),
      });
    }
  };

  const validate = () => item && item.name;

  return (
    <EditItemView
      endpoint="geofences"
      item={item}
      setItem={setItem}
      defaultItem={defaultItem}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedGeofence']}
      description={t('geofencePageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
            />
          </FormSection>
          <FormSection title={t('formSectionMore')}>
            <TextField
              value={item.description || ''}
              onChange={(event) => setItem({ ...item, description: event.target.value })}
              label={t('sharedDescription')}
              helperText={t('sharedDescriptionHelp')}
            />
            <SelectField
              value={item.calendarId}
              onChange={(event) => setItem({ ...item, calendarId: Number(event.target.value) })}
              endpoint="api/calendars"
              label={t('sharedCalendar')}
              helperText={t('geofenceCalendarHelp')}
            />
            <CheckboxField
              checked={item.attributes.hide}
              onChange={(e) =>
                setItem({
                  ...item,
                  attributes: { ...item.attributes, hide: e.target.checked },
                })
              }
              label={t('sharedFilterMap')}
              helperText={t('geofenceHideHelp')}
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

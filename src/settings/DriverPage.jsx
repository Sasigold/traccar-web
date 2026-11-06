import { useState } from 'react';
import { useDispatch } from 'react-redux';
import TextField from '@mui/material/TextField';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';

import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { driversActions } from '../store';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FleetDocumentsSection from './components/FleetDocumentsSection';
import FleetFieldsSection from '../fleet/components/FleetFieldsSection';
import {
  driverExpiryFields,
  driverFieldKeys,
  driverFields,
  driverLicenseFields,
  mergeAttributes,
  notesField,
  splitAttributes,
} from '../common/fleet/fleetFields';

const DriverPage = () => {
  const t = useTranslation();

  const dispatch = useDispatch();

  const [item, setItem] = useState();

  // Keep the cached drivers (expiry tile, expiries page) in step with the edit.
  const onItemSaved = useCatch(async () => {
    const response = await fetchOrThrow('api/drivers');
    dispatch(driversActions.refresh(await response.json()));
  });

  const setAttributes = (attributes) => setItem({ ...item, attributes });

  const validate = () => item && item.name && item.uniqueId;

  return (
    <EditItemView
      endpoint="drivers"
      item={item}
      setItem={setItem}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedDriver']}
    >
      {item && (
        <>
          <FormSection title={t('sharedRequired')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
            />
            <TextField
              value={item.uniqueId || ''}
              onChange={(event) => setItem({ ...item, uniqueId: event.target.value })}
              label={t('deviceIdentifier')}
            />
          </FormSection>
          <FleetFieldsSection
            title={t('fleetDriverDetails')}
            icon={<BadgeRoundedIcon />}
            fields={[...driverFields, notesField]}
            attributes={item.attributes}
            setAttributes={setAttributes}
          />
          <FleetFieldsSection
            title={t('fleetDriverLicense')}
            description={t('fleetExpiryHint')}
            icon={<CreditCardRoundedIcon />}
            fields={[...driverLicenseFields, ...driverExpiryFields]}
            attributes={item.attributes}
            setAttributes={setAttributes}
            showExpiry
          />
          <FleetDocumentsSection
            entity="driver"
            traccarId={item.id}
            name={item.name}
            identifier={item.uniqueId}
          />
          <EditAttributesAccordion
            attributes={splitAttributes(item.attributes, driverFieldKeys)}
            setAttributes={(other) =>
              setAttributes(mergeAttributes(item.attributes, driverFieldKeys, other))
            }
            definitions={{}}
          />
        </>
      )}
    </EditItemView>
  );
};

export default DriverPage;

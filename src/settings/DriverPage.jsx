import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';
import { useFleetPermission } from '../common/fleet/useFleet';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';

import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { driversActions, messagesActions } from '../store';
import { saveFleetRecord, useFleetAccess, useFleetOverlay } from '../fleet/fleetRecords';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FleetDocumentsSection from './components/FleetDocumentsSection';
import DriverAssignmentSection from '../fleet/components/DriverAssignmentSection';
import HistorySection from '../fleet/components/HistorySection';
import FleetFieldsSection from '../fleet/components/FleetFieldsSection';
import ScanDocumentButton from '../fleet/components/ScanDocumentButton';
import { driverValues } from '../common/fleet/documentScan';
import { digitsOf } from '../common/util/israeliFields';
import {
  driverExpiryFields,
  driverFieldKeys,
  driverFields,
  fleetFieldsValid,
  driverLicenseFields,
  mergeAttributes,
  notesField,
  splitAttributes,
} from '../common/fleet/fleetFields';

// A unique identifier for a driver without a tag: "drv-" and 8 random characters.
export const generatedDriverId = () =>
  `drv-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    'abcdefghjkmnpqrstuvwxyz23456789'.charAt(byte % 31),
  ).join('')}`;

const DriverPage = () => {
  const t = useTranslation();

  const dispatch = useDispatch();

  const [item, setItem] = useState();

  const fleet = useFleetAccess('driver');
  const safety = useFleetPermission('safety.read');
  useFleetOverlay('driver', item, setItem);

  // Traccar first, then the fleet database; keep the cached drivers (validity tile and page)
  // in step. Errors are reported without undoing the Traccar save.
  const onItemSaved = async (saved) => {
    try {
      if (fleet.write) {
        await saveFleetRecord('driver', saved, fleet.profile, { withDocuments: fleet.documents });
      }
      const response = await fetchOrThrow('api/drivers');
      dispatch(driversActions.refresh(await response.json()));
    } catch (error) {
      dispatch(messagesActions.push(error.message));
    }
  };

  const setAttributes = (attributes) => setItem({ ...item, attributes });

  // ADM-06: another driver with the same ID number, by name.
  const drivers = useSelector((state) => state.drivers.items);
  const idTakenBy = (key, value) =>
    key === 'nationalId'
      ? Object.values(drivers).find(
          (driver) =>
            driver.id !== item?.id &&
            digitsOf(driver.attributes?.nationalId) &&
            digitsOf(driver.attributes?.nationalId).padStart(9, '0') ===
              digitsOf(value).padStart(9, '0'),
        )?.name
      : null;

  // ADM-17: the identifier is the driver's tag or card number, and not every driver has one;
  // Traccar needs a unique value, so one is made up when it is left empty.
  const validate = () => item && item.name && fleetFieldsValid(driverFields, item.attributes);
  const prepare = (value) =>
    value.uniqueId?.trim() ? value : { ...value, uniqueId: generatedDriverId() };

  return (
    <EditItemView
      endpoint="drivers"
      item={item}
      setItem={setItem}
      validate={validate}
      prepare={prepare}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'sharedDriver']}
      description={t('driverPageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
            />
            <TextField
              value={item.uniqueId || ''}
              onChange={(event) => setItem({ ...item, uniqueId: event.target.value })}
              label={t('driverTagNumber')}
              helperText={t('driverTagNumberHelp')}
            />
          </FormSection>
          <FleetFieldsSection
            title={t('fleetDriverDetails')}
            icon={<BadgeRoundedIcon />}
            fields={[...driverFields, notesField]}
            attributes={item.attributes}
            setAttributes={setAttributes}
            duplicateOf={idTakenBy}
          />
          <FleetFieldsSection
            title={t('fleetDriverLicense')}
            description={t('fleetExpiryHint')}
            icon={<CreditCardRoundedIcon />}
            fields={[...driverLicenseFields, ...driverExpiryFields]}
            attributes={item.attributes}
            setAttributes={setAttributes}
            showExpiry
            actions={
              <ScanDocumentButton
                kind="driver_license"
                label={t('scanDriverLicense')}
                onApply={({ fields }) => {
                  // AI-04: a scanned driving license fills the license (not saved yet).
                  const { values, name } = driverValues(fields, item);
                  setItem({
                    ...item,
                    ...(name ? { name } : {}),
                    attributes: { ...item.attributes, ...values },
                  });
                }}
              />
            }
          />
          {item.id && safety && (
            <Button
              variant="outlined"
              component={RouterLink}
              to={`/fleet/driver-file/${item.id}`}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('fleetDriverFile')}
            </Button>
          )}
          <DriverAssignmentSection driver={item} />
          <FleetDocumentsSection
            entity="driver"
            traccarId={item.id}
            name={item.name}
            identifier={item.uniqueId}
          />
          <HistorySection entity="driver" traccarId={item.id} />
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

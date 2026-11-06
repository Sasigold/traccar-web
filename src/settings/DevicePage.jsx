import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Typography } from '@mui/material';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import FileInput from '../common/components/FileInput';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import SelectField from '../common/components/SelectField';
import deviceCategories from '../common/util/deviceCategories';
import { useTranslation } from '../common/components/LocalizationProvider';
import useDeviceAttributes from '../common/attributes/useDeviceAttributes';
import { useManager } from '../common/util/permissions';
import SettingsMenu from './components/SettingsMenu';
import useCommonDeviceAttributes from '../common/attributes/useCommonDeviceAttributes';
import { useCatch } from '../reactHelper';
import ServerQrCodeDialog from '../common/components/ServerQrCodeDialog';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';
import { devicesActions, messagesActions } from '../store';
import { saveFleetRecord, useFleetAccess, useFleetOverlay } from '../fleet/fleetRecords';
import FleetDocumentsSection from './components/FleetDocumentsSection';
import HistorySection from '../fleet/components/HistorySection';
import FleetFieldsSection from '../fleet/components/FleetFieldsSection';
import MaintenanceStatusSection from '../fleet/components/MaintenanceStatusSection';
import {
  mergeAttributes,
  notesField,
  splitAttributes,
  vehicleExpiryFields,
  vehicleFieldKeys,
  vehicleFields,
} from '../common/fleet/fleetFields';

const DevicePage = () => {
  const t = useTranslation();

  const dispatch = useDispatch();
  const manager = useManager();

  const commonDeviceAttributes = useCommonDeviceAttributes(t);
  const deviceAttributes = useDeviceAttributes(t);

  const [searchParams] = useSearchParams();
  const uniqueId = searchParams.get('uniqueId');

  const [item, setItem] = useState(uniqueId ? { uniqueId } : null);
  const [showQr, setShowQr] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  const handleFileInput = useCatch(async (newFile) => {
    setImageFile(newFile);
    if (newFile && item?.id) {
      const response = await fetchOrThrow(`api/devices/${item.id}/image`, {
        method: 'POST',
        body: newFile,
      });
      setItem({ ...item, attributes: { ...item.attributes, deviceImage: await response.text() } });
    } else if (!newFile) {
      // eslint-disable-next-line no-unused-vars
      const { deviceImage, ...remainingAttributes } = item.attributes || {};
      setItem({ ...item, attributes: remainingAttributes });
    }
  });

  const setAttributes = (attributes) => setItem({ ...item, attributes });

  const fleet = useFleetAccess('vehicle');
  useFleetOverlay('vehicle', item, setItem);

  // Traccar is saved first; the fleet database follows. A database error is reported but does
  // not undo the Traccar save (saving again retries it).
  const onItemSaved = async (saved) => {
    dispatch(devicesActions.update([saved]));
    if (fleet.write) {
      try {
        await saveFleetRecord('vehicle', saved, fleet.profile, { withDocuments: fleet.documents });
      } catch (error) {
        dispatch(messagesActions.push(error.message));
      }
    }
  };

  const validate = () => item && item.name && item.uniqueId;

  return (
    <EditItemView
      endpoint="devices"
      item={item}
      setItem={setItem}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedDevice']}
      description={t('devicePageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.name || ''}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              label={t('sharedName')}
              helperText={t('deviceNameHelp')}
            />
            <TextField
              value={item.uniqueId || ''}
              onChange={(event) => setItem({ ...item, uniqueId: event.target.value })}
              label={t('deviceIdentifier')}
              helperText={t('deviceIdentifierHelp')}
              disabled={Boolean(uniqueId)}
            />
          </FormSection>
          <FleetFieldsSection
            title={t('fleetVehicleDetails')}
            icon={<DirectionsCarRoundedIcon />}
            fields={[...vehicleFields, notesField]}
            attributes={item.attributes}
            setAttributes={setAttributes}
          />
          <FleetFieldsSection
            title={t('fleetVehicleValidity')}
            description={t('fleetExpiryHint')}
            icon={<EventAvailableRoundedIcon />}
            fields={vehicleExpiryFields}
            attributes={item.attributes}
            setAttributes={setAttributes}
            showExpiry
          />
          {item.id && <MaintenanceStatusSection deviceId={item.id} />}
          <FormSection title={t('formSectionMore')}>
            <SelectField
              value={item.groupId}
              onChange={(event) => setItem({ ...item, groupId: Number(event.target.value) })}
              endpoint="api/groups"
              label={t('groupParent')}
              helperText={t('deviceGroupHelp')}
            />
            <TextField
              value={item.phone || ''}
              onChange={(event) => setItem({ ...item, phone: event.target.value })}
              label={t('sharedPhone')}
              helperText={t('devicePhoneHelp')}
            />
            <TextField
              value={item.model || ''}
              onChange={(event) => setItem({ ...item, model: event.target.value })}
              label={t('deviceModel')}
              helperText={t('deviceModelHelp')}
            />
            <TextField
              value={item.contact || ''}
              onChange={(event) => setItem({ ...item, contact: event.target.value })}
              label={t('deviceContact')}
              helperText={t('deviceContactHelp')}
            />
            <SelectField
              value={item.category || 'default'}
              onChange={(event) => setItem({ ...item, category: event.target.value })}
              data={deviceCategories
                .map((category) => ({
                  id: category,
                  name: t(`category${category.replace(/^\w/, (c) => c.toUpperCase())}`),
                }))
                .sort((a, b) => a.name.localeCompare(b.name))}
              label={t('deviceCategory')}
              helperText={t('deviceCategoryHelp')}
            />
            <SelectField
              value={item.calendarId}
              onChange={(event) => setItem({ ...item, calendarId: Number(event.target.value) })}
              endpoint="api/calendars"
              label={t('sharedCalendar')}
              helperText={t('deviceCalendarHelp')}
            />
            <TextField
              label={t('userExpirationTime')}
              type="date"
              value={item.expirationTime ? item.expirationTime.split('T')[0] : '2099-01-01'}
              onChange={(e) => {
                if (e.target.value) {
                  setItem({ ...item, expirationTime: new Date(e.target.value).toISOString() });
                }
              }}
              helperText={t('deviceExpirationHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.disabled}
              onChange={(event) => setItem({ ...item, disabled: event.target.checked })}
              label={t('sharedDisabled')}
              helperText={t('deviceDisabledHelp')}
              disabled={!manager}
            />
            <div>
              <Button variant="outlined" color="primary" onClick={() => setShowQr(true)}>
                {t('sharedQrCode')}
              </Button>
              <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 0.5 }}>
                {t('deviceQrHelp')}
              </Typography>
            </div>
          </FormSection>
          {item.id && (
            <FormSection title={t('attributeDeviceImage')} description={t('deviceImageHelp')}>
              <FileInput
                placeholder={t('attributeDeviceImage')}
                value={imageFile}
                onChange={handleFileInput}
                slotProps={{ htmlInput: { accept: 'image/*' } }}
              />
            </FormSection>
          )}
          <FleetDocumentsSection
            entity="vehicle"
            traccarId={item.id}
            name={item.name}
            identifier={item.uniqueId}
          />
          <HistorySection entity="vehicle" traccarId={item.id} />
          <EditAttributesAccordion
            attributes={splitAttributes(item.attributes, vehicleFieldKeys)}
            setAttributes={(other) =>
              setAttributes(mergeAttributes(item.attributes, vehicleFieldKeys, other))
            }
            definitions={{ ...commonDeviceAttributes, ...deviceAttributes }}
            itemId={item.id}
          />
        </>
      )}
      <ServerQrCodeDialog open={showQr} onClose={() => setShowQr(false)} />
    </EditItemView>
  );
};

export default DevicePage;

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { TextField } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { useAttributePreference } from '../common/util/preferences';
import { distanceFromMeters, distanceToMeters, distanceUnitString } from '../common/util/converter';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const AccumulatorsPage = () => {
  const navigate = useNavigate();
  const t = useTranslation();

  const distanceUnit = useAttributePreference('distanceUnit');

  const { deviceId } = useParams();
  const position = useSelector((state) => state.session.positions[deviceId]);

  const [item, setItem] = useState();

  useEffect(() => {
    if (position && !item) {
      setItem({
        deviceId: parseInt(deviceId, 10),
        hours: position.attributes.hours || 0,
        totalDistance: position.attributes.totalDistance || 0,
      });
    }
  }, [deviceId, position, item]);

  const handleSave = useCatch(async () => {
    await fetchOrThrow(`api/devices/${deviceId}/accumulators`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    navigate(-1);
  });

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['sharedDeviceAccumulators']}
      description={t('accumulatorsPageDescription')}
      footer={<SaveBar onCancel={() => navigate(-1)} onSave={handleSave} />}
    >
      {item && (
        <FormSection title={t('formSectionBasic')}>
          <TextField
            type="number"
            value={item.hours / 3600000}
            onChange={(event) => setItem({ ...item, hours: Number(event.target.value) * 3600000 })}
            label={t('positionHours')}
            helperText={t('accumulatorsHoursHelp')}
          />
          <TextField
            type="number"
            value={distanceFromMeters(item.totalDistance, distanceUnit)}
            onChange={(event) =>
              setItem({
                ...item,
                totalDistance: distanceToMeters(Number(event.target.value), distanceUnit),
              })
            }
            label={`${t('deviceTotalDistance')} (${distanceUnitString(distanceUnit, t)})`}
            helperText={t('accumulatorsDistanceHelp')}
          />
        </FormSection>
      )}
    </FormPage>
  );
};

export default AccumulatorsPage;

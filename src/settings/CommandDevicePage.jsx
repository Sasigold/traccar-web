import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import { useTranslation } from '../common/components/LocalizationProvider';
import BaseCommandView from './components/BaseCommandView';
import SettingsMenu from './components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';
import useSendCommand from '../common/components/commands/useSendCommand';
import EngineStopConfirm from '../common/components/commands/EngineStopConfirm';
import {
  confirmationMatches,
  confirmationTarget,
  isDangerousCommand,
} from '../common/util/commands';

const CommandDevicePage = () => {
  const navigate = useNavigate();
  const t = useTranslation();
  const sendCommand = useSendCommand();

  const { id } = useParams();
  const deviceId = parseInt(id, 10);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const [savedId, setSavedId] = useState(0);
  const [savedCommand, setSavedCommand] = useState(null);
  const [item, setItem] = useState({});
  const [confirmation, setConfirmation] = useState('');

  // A saved command can be an engine stop too: read its type before it can be sent.
  useAsyncTask(
    async ({ signal }) => {
      setSavedCommand(null);
      if (savedId) {
        const response = await fetchOrThrow(`api/commands/${savedId}`, { signal });
        setSavedCommand(await response.json());
      }
    },
    [savedId],
  );

  const command = savedId ? savedCommand : item?.type ? item : null;
  const dangerous = isDangerousCommand(command?.type);
  const confirmed =
    !dangerous || confirmationMatches(confirmation, confirmationTarget(device).value);

  const handleSend = useCatch(async () => {
    await sendCommand(deviceId, command);
    navigate(-1);
  });

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'deviceCommand']}
      description={t('commandDevicePageDescription')}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={handleSend}
          disabled={!command || !confirmed}
          saveLabel={dangerous ? t('commandEngineStop') : t('commandSend')}
          saveColor={dangerous ? 'error' : undefined}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <BaseCommandView
          deviceId={id}
          item={item}
          setItem={(value) => {
            if (value?.type !== item?.type) {
              setConfirmation('');
            }
            setItem(value);
          }}
          includeSaved
          savedId={savedId}
          setSavedId={(value) => {
            setSavedId(value);
            setConfirmation('');
          }}
        />
        {dangerous && (
          <EngineStopConfirm deviceId={deviceId} value={confirmation} onChange={setConfirmation} />
        )}
      </FormSection>
    </FormPage>
  );
};

export default CommandDevicePage;

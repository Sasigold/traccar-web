import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import { useTranslation } from '../common/components/LocalizationProvider';
import BaseCommandView from './components/BaseCommandView';
import SettingsMenu from './components/SettingsMenu';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { messagesActions } from '../store';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const CommandDevicePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const { id } = useParams();

  const [savedId, setSavedId] = useState(0);
  const [item, setItem] = useState({});

  const handleSend = useCatch(async () => {
    let command;
    if (savedId) {
      const response = await fetchOrThrow(`api/commands/${savedId}`);
      command = await response.json();
    } else {
      command = item;
    }

    command.deviceId = parseInt(id, 10);

    const response = await fetchOrThrow('api/commands/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    dispatch(
      messagesActions.push({
        message: t(response.status === 202 ? 'commandQueued' : 'commandSent'),
        severity: 'success',
      }),
    );
    navigate(-1);
  });

  const validate = () => savedId || (item && item.type);

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'deviceCommand']}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={handleSend}
          disabled={!validate()}
          saveLabel={t('commandSend')}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <BaseCommandView
          deviceId={id}
          item={item}
          setItem={setItem}
          includeSaved
          savedId={savedId}
          setSavedId={setSavedId}
        />
      </FormSection>
    </FormPage>
  );
};

export default CommandDevicePage;

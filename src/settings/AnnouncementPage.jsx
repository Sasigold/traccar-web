import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { useCatchCallback } from '../reactHelper';
import SelectField from '../common/components/SelectField';
import { prefixString } from '../common/util/stringUtils';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const AnnouncementPage = () => {
  const navigate = useNavigate();
  const t = useTranslation();

  const [users, setUsers] = useState([]);
  const [notificator, setNotificator] = useState();
  const [message, setMessage] = useState({});

  const handleSend = useCatchCallback(async () => {
    const query = new URLSearchParams();
    users.forEach((userId) => query.append('userId', userId));
    await fetchOrThrow(`api/notifications/send/${notificator}?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    navigate(-1);
  }, [users, notificator, message, navigate]);

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['serverAnnouncement']}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={handleSend}
          disabled={!notificator || !message.subject || !message.body}
          saveLabel={t('commandSend')}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <SelectField
          multiple
          value={users}
          onChange={(e) => setUsers(e.target.value)}
          endpoint="api/users"
          label={t('settingsUsers')}
        />
        <SelectField
          value={notificator}
          onChange={(e) => setNotificator(e.target.value)}
          endpoint="api/notifications/notificators?announcement=true"
          keyGetter={(it) => it.type}
          titleGetter={(it) => t(prefixString('notificator', it.type))}
          label={t('notificationNotificators')}
        />
        <TextField
          value={message.subject}
          onChange={(e) => setMessage({ ...message, subject: e.target.value })}
          label={t('sharedSubject')}
        />
        <TextField
          value={message.body}
          onChange={(e) => setMessage({ ...message, body: e.target.value })}
          label={t('commandMessage')}
        />
      </FormSection>
    </FormPage>
  );
};

export default AnnouncementPage;

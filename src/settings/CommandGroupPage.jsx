import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { messagesActions } from '../store';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const CommandDevicePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const { id } = useParams();

  const textEnabled = useSelector((state) => state.session.server.textEnabled);

  const [item, setItem] = useState({ type: 'custom', attributes: {} });

  const handleSend = useCatch(async () => {
    const query = new URLSearchParams({ groupId: id });
    const response = await fetchOrThrow(`api/commands/send?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    dispatch(
      messagesActions.push({
        message: t(response.status === 202 ? 'commandQueued' : 'commandSent'),
        severity: 'success',
      }),
    );
    navigate(-1);
  });

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'deviceCommand']}
      description={t('commandGroupPageDescription')}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={handleSend}
          disabled={!item.attributes.data}
          saveLabel={t('commandSend')}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <FormControl fullWidth>
          <InputLabel id="command-group-page-shared-type-label">{t('sharedType')}</InputLabel>
          <Select
            labelId="command-group-page-shared-type-label"
            label={t('sharedType')}
            value="custom"
            disabled
          >
            <MenuItem value="custom">{t('commandCustom')}</MenuItem>
          </Select>
        </FormControl>
        <TextField
          value={item.attributes.data}
          onChange={(e) =>
            setItem({ ...item, attributes: { ...item.attributes, data: e.target.value } })
          }
          label={t('commandDataLabel')}
          helperText={t('commandDataHelp')}
        />
        {textEnabled && (
          <CheckboxField
            checked={item.textChannel}
            onChange={(event) => setItem({ ...item, textChannel: event.target.checked })}
            label={t('commandSendSms')}
            helperText={t('commandSendSmsHelp')}
          />
        )}
      </FormSection>
    </FormPage>
  );
};

export default CommandDevicePage;

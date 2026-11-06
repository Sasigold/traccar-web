import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { TextField, Button } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const SharePage = () => {
  const navigate = useNavigate();
  const t = useTranslation();

  const { type, id } = useParams();

  const item = useSelector((state) =>
    type === 'group' ? state.groups.items[id] : state.devices.items[id],
  );

  const [expiration, setExpiration] = useState(() =>
    dayjs().add(1, 'week').locale('en').format('YYYY-MM-DDTHH:mm'),
  );
  const [link, setLink] = useState();

  const handleShare = useCatchCallback(async () => {
    const expirationTime = dayjs(expiration).toISOString();
    const response = await fetchOrThrow(`api/share/${type}`, {
      method: 'POST',
      body: new URLSearchParams(`${type}Id=${id}&expiration=${expirationTime}`),
    });
    const token = await response.text();
    setLink(`${document.baseURI}?token=${token}`);
  }, [id, expiration, type, setLink]);

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['sharedShare']}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={() => navigator.clipboard?.writeText(link)}
          disabled={!link}
          saveLabel={t('sharedCopy')}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <TextField
          value={item.name}
          label={t(type === 'group' ? 'groupDialog' : 'sharedDevice')}
          disabled
        />
        <TextField
          label={t('userExpirationTime')}
          type="datetime-local"
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
        />
        <Button variant="outlined" color="primary" onClick={handleShare}>
          {t('reportShow')}
        </Button>
        <TextField
          value={link || ''}
          onChange={(e) => setLink(e.target.value)}
          label={t('sharedLink')}
          slotProps={{ input: { readOnly: true } }}
        />
      </FormSection>
    </FormPage>
  );
};

export default SharePage;

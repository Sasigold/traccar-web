import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { TextField, Button, Stack } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { messagesActions } from '../store';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';
import { DateTimeField } from '../common/components/pickers';

const SharePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
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

  const copy = useCatchCallback(async () => {
    await navigator.clipboard?.writeText(link);
    dispatch(messagesActions.push({ message: t('sharedCopied'), severity: 'success' }));
  }, [link, dispatch, t]);

  // ADM-25: first make the link (the one main action), then copy it or send it on WhatsApp.
  const whatsapp = link
    ? `https://wa.me/?text=${encodeURIComponent(
        t('shareWhatsappText')
          .replace('{0}', item?.name || '')
          .replace('{1}', link),
      )}`
    : null;

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['sharedShare']}
      description={t('sharePageDescription')}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={link ? copy : handleShare}
          saveLabel={t(link ? 'sharedCopy' : 'shareCreateLink')}
        />
      }
    >
      <FormSection title={t('formSectionBasic')}>
        <TextField
          value={item?.name || ''}
          label={t(type === 'group' ? 'groupDialog' : 'sharedDevice')}
          disabled
        />
        <DateTimeField
          label={t('shareValidUntil')}
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
          helperText={t('shareExpirationHelp')}
        />
        {link && (
          <>
            <TextField
              value={link}
              label={t('sharedLink')}
              helperText={t('shareLinkHelp')}
              slotProps={{ input: { readOnly: true }, htmlInput: { dir: 'ltr' } }}
            />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<WhatsAppIcon />}
                sx={{ whiteSpace: 'nowrap' }}
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('shareSendWhatsapp')}
              </Button>
              <Button onClick={handleShare} sx={{ whiteSpace: 'nowrap' }}>
                {t('shareNewLink')}
              </Button>
            </Stack>
          </>
        )}
      </FormSection>
    </FormPage>
  );
};

export default SharePage;

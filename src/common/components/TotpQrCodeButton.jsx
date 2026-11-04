import { useState } from 'react';
import { useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import QrCodeDialog from './QrCodeDialog';
import { useTranslation } from './LocalizationProvider';

const TotpQrCodeButton = ({ email, totpKey }) => {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const title = useSelector((state) => state.session.server.attributes.title);

  if (!email || !totpKey) {
    return null;
  }

  const issuer = encodeURIComponent(title || 'Traccar');
  const account = encodeURIComponent(email);
  const secret = encodeURIComponent(totpKey);
  const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;

  return (
    <>
      <IconButton
        size="small"
        edge="end"
        onClick={() => setOpen(true)}
        aria-label={t('sharedQrCode')}
      >
        <QrCode2Icon fontSize="small" />
      </IconButton>
      <QrCodeDialog open={open} onClose={() => setOpen(false)} value={uri} />
    </>
  );
};

export default TotpQrCodeButton;

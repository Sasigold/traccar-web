import { useState } from 'react';
import { Link, Typography } from '@mui/material';
import { useTranslation } from './LocalizationProvider';

// SEC-16: an ID or card number shows only its last digits until someone asks to see it.
export const maskValue = (value, visible = 4) => {
  const text = String(value ?? '');
  if (text.length <= visible) return text;
  return `${'•'.repeat(Math.min(text.length - visible, 6))}${text.slice(-visible)}`;
};

const MaskedValue = ({ value, visible = 4 }) => {
  const t = useTranslation();
  const [shown, setShown] = useState(false);
  if (!value) return null;
  return (
    <Typography variant="body2" component="span" dir="ltr">
      <bdi>{shown ? value : maskValue(value, visible)}</bdi>{' '}
      {!shown && (
        <Link component="button" type="button" variant="body2" onClick={() => setShown(true)}>
          {t('sharedShow')}
        </Link>
      )}
    </Typography>
  );
};

export default MaskedValue;

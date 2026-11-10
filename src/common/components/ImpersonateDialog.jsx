import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from './LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { startImpersonation } from '../util/impersonation';
import { keepOnBackdrop } from '../util/formDialog';

// SEC-13: logging in as another user needs a reason; it is recorded with who did it.
const ImpersonateDialog = ({ user, onClose }) => {
  const t = useTranslation();
  const me = useSelector((state) => state.session.user);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 5;

  const go = useCatch(async () => {
    setBusy(true);
    try {
      await startImpersonation(user, me, reason.trim());
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t('impersonateTitle').replace('{0}', user.name)}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {t('impersonateHelp')}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label={t('impersonateReason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          helperText={t('impersonateReasonHelp')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={go} disabled={!valid || busy}>
          {t('impersonateGo')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImpersonateDialog;

import { Button, Dialog, DialogTitle, DialogActions } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from './LocalizationProvider';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../util/fetchOrThrow';

const RemoveDialog = ({ open, endpoint, itemId, onResult }) => {
  const t = useTranslation();

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`api/${endpoint}/${itemId}`, { method: 'DELETE' });
    onResult(true);
  });

  return (
    <Dialog open={open} onClose={() => onResult(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sharedRemoveConfirm')}</DialogTitle>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={() => onResult(false)} autoFocus>
          {t('sharedCancel')}
        </Button>
        <Button
          color="error"
          variant="contained"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={handleRemove}
        >
          {t('sharedRemove')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoveDialog;

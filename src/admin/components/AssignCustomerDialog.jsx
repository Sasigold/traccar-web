import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import CustomerSelect from './CustomerSelect';

// Asks for a customer (or none) and hands it to `onAssign`.
const AssignCustomerDialog = ({
  open,
  title,
  description,
  customers,
  initial = null,
  onClose,
  onAssign,
}) => {
  const t = useTranslation();
  const [customerId, setCustomerId] = useState(initial);
  const [busy, setBusy] = useState(false);

  const handleAssign = async () => {
    setBusy(true);
    try {
      await onAssign(customerId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        {description && (
          <Typography variant="body2" color="textSecondary">
            {description}
          </Typography>
        )}
        <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {t('sharedCancel')}
        </Button>
        <Button variant="contained" onClick={handleAssign} disabled={busy}>
          {t('adminAssign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignCustomerDialog;

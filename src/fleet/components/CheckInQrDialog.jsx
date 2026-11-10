import { useState } from 'react';
import { QRCode } from 'react-qr-code';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { checkinUrl } from '../../common/fleet/checkin';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    textAlign: 'center',
  },
  // The code is printed black on white whatever the theme, so every camera reads it.
  qr: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.common.white,
    borderRadius: theme.tokens.radius.md,
  },
}));

// SAF-02: the QR to print and stick in the cabin. Scanning it in the driver area makes the trips
// from then on the driver's. "New code" stops the old print from working.
const CheckInQrDialog = ({ vehicle, deviceId, name, onClose, onChanged }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const [code, setCode] = useState(vehicle.checkin_code);
  const url = checkinUrl(new URL(document.baseURI).toString(), deviceId, code);

  const renew = useCatch(async () => {
    if (!(await confirm({ title: t('checkinNewCode'), message: t('checkinNewCodeConfirm') })))
      return;
    setCode(
      unwrap(await getFleetClient().rpc('vehicle_new_checkin_code', { p_vehicle: vehicle.id })),
    );
    onChanged?.();
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('checkinQrTitle')}</DialogTitle>
      <DialogContent className={classes.content}>
        <Typography variant="h6" component="p">
          {name}
        </Typography>
        <div className={classes.qr}>
          <QRCode
            value={url}
            size={200}
            fgColor={theme.palette.common.black}
            bgColor={theme.palette.common.white}
            title={t('checkinQrTitle')}
          />
        </div>
        <Typography variant="body2" color="textSecondary">
          {t('checkinQrHelp')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={renew}>{t('checkinNewCode')}</Button>
        <Button onClick={() => window.print()}>{t('reportPrint')}</Button>
        <Button onClick={onClose}>{t('sharedHide')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CheckInQrDialog;

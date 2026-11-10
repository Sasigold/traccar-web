import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useInvalidateFleet } from '../../common/data/fleetQuery';
import { messagesActions } from '../../store';
import { fieldError } from '../../common/util/israeliFields';
import { useOrgContact } from './DispatcherContact';

// ADM-22: the dispatcher a driver calls from the portal (and when the driver is not linked yet).
const DispatcherContactSettings = () => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const invalidate = useInvalidateFleet();
  const contact = useOrgContact();
  const [form, setForm] = useState(null);
  const values = form || { name: contact?.name || '', phone: contact?.phone || '' };
  const phoneError = values.phone && fieldError('phone', values.phone);

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient().rpc('set_org_contact', { p_name: values.name, p_phone: values.phone }),
    );
    invalidate('organizations');
    setForm(null);
    dispatch(messagesActions.push({ message: t('sharedSaved'), severity: 'success' }));
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, mx: 3, mb: 2, borderRadius: 3 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t('dispatchContactTitle')}
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {t('dispatchContactHint')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
        <TextField
          size="small"
          label={t('sharedName')}
          value={values.name}
          onChange={(event) => setForm({ ...values, name: event.target.value })}
        />
        <TextField
          size="small"
          label={t('sharedPhone')}
          value={values.phone}
          onChange={(event) => setForm({ ...values, phone: event.target.value })}
          error={Boolean(phoneError)}
          helperText={phoneError ? t(phoneError) : undefined}
          slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'tel' } }}
        />
        <Button variant="outlined" onClick={save} disabled={!form || Boolean(phoneError)}>
          {t('sharedSave')}
        </Button>
      </Stack>
    </Paper>
  );
};

export default DispatcherContactSettings;

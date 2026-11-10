import { Button, Stack, Typography } from '@mui/material';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetQuery } from '../../common/data/fleetQuery';
import { useFleetReady } from '../../common/fleet/useFleet';
import { normalizeRecipientAddress } from '../alerts';

// ADM-22: who the driver calls: the dispatcher set by the fleet (org_contact()).
export const useOrgContact = () => {
  const ready = useFleetReady();
  const { data } = useFleetQuery(
    'organizations',
    ['contact'],
    (client) => client.rpc('org_contact'),
    { enabled: ready },
  );
  return data?.phone ? data : null;
};

// An international number for wa.me (digits only, 972… for a local number).
export const whatsappNumber = (phone) =>
  normalizeRecipientAddress('whatsapp', phone).replace(/^\+/, '');

const DispatcherContact = ({ contact, compact = false }) => {
  const t = useTranslation();
  if (!contact?.phone) return null;
  return (
    <Stack spacing={1}>
      {!compact && (
        <Typography>
          {t('driverContactDispatcherName').replace('{0}', contact.name || t('driverDispatcher'))}
        </Typography>
      )}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<PhoneRoundedIcon />}
          href={`tel:${contact.phone}`}
          aria-label={`${t('driverCall')} ${contact.name || t('driverDispatcher')}`}
        >
          {t('driverCall')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<WhatsAppIcon />}
          href={`https://wa.me/${whatsappNumber(contact.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </Button>
      </Stack>
    </Stack>
  );
};

export default DispatcherContact;

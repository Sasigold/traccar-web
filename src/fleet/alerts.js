import { getFleetClient, unwrap } from '../common/fleet/client';

export const countOpenAlerts = async () => {
  const { count, error } = await getFleetClient()
    .from('document_alerts_open')
    .select('id', { count: 'exact', head: true });
  if (error) {
    throw new Error(error.message);
  }
  return count || 0;
};

export const loadOpenAlerts = async () =>
  unwrap(
    await getFleetClient()
      .from('document_alerts_open')
      .select('*')
      .order('expires_at', { ascending: true }),
  ) || [];

export const acknowledgeAlerts = async (ids, profileId) =>
  unwrap(
    await getFleetClient()
      .from('document_alerts')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: profileId })
      .in('id', ids),
  );

export const alertKinds = ['document_expiry', 'maintenance', 'report'];
export const alertChannels = ['whatsapp', 'sms', 'email'];

// WhatsApp and SMS need an international number (+972...), email a plausible address.
export const isPhoneChannel = (channel) => channel === 'whatsapp' || channel === 'sms';

export const validRecipientAddress = (channel, address) => {
  const value = (address || '').trim();
  if (isPhoneChannel(channel)) {
    return /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s-]/g, ''));
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

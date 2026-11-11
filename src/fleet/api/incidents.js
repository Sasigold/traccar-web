import { unwrap } from '../../common/fleet/client';

// ARC-10: the incident's reads, out of the page (the pure rules are in
// common/fleet/incidents.js). `client` is the fleet client.

// The incident with its vehicle and driver ids, the other parties, the insurance claim (if
// any) and the photos, oldest first.
export const loadIncident = async (client, id) => {
  const [incident, parties, claim, photos] = await Promise.all([
    client
      .from('incidents')
      .select('*, vehicles(traccar_device_id), drivers(traccar_driver_id)')
      .eq('id', id)
      .single(),
    client.from('incident_parties').select('*').eq('incident_id', id),
    client.from('insurance_claims').select('*').eq('incident_id', id).maybeSingle(),
    client.from('incident_photos').select('*').eq('incident_id', id).order('created_at'),
  ]);
  return {
    incident: unwrap(incident),
    parties: unwrap(parties) || [],
    claim: unwrap(claim),
    photos: unwrap(photos) || [],
  };
};

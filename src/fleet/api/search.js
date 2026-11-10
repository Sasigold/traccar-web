import { unwrap } from '../../common/fleet/client';

// ADM-31: Ctrl+K also finds what lives only in the fleet database: work orders and incidents,
// by number or by words. `can` says which areas the person may read. Each result opens its page.
const ilike = (text) => `%${text.replace(/[%_,()]/g, ' ').trim()}%`;

export const searchFleet = async (client, text, can, signal) => {
  const query = text.trim();
  if (query.length < 2) return [];
  const number = /^#?(\d{1,7})$/.exec(query)?.[1];
  const requests = [];
  if (can.maintenance) {
    let builder = client
      .from('work_orders')
      .select('id, number, title, status, vehicles(plate_number)');
    builder = number ? builder.eq('number', Number(number)) : builder.ilike('title', ilike(query));
    requests.push(
      builder
        .order('opened_at', { ascending: false })
        .limit(5)
        .abortSignal(signal)
        .then((result) =>
          (unwrap(result) || []).map((row) => ({
            kind: 'workOrder',
            id: row.id,
            number: row.number,
            title: row.title,
            plate: row.vehicles?.plate_number,
            path: `/fleet/work-order/${row.id}`,
          })),
        ),
    );
  }
  if (can.incidents) {
    let builder = client
      .from('incidents')
      .select('id, number, type, description, vehicles(plate_number)');
    builder = number
      ? builder.eq('number', Number(number))
      : builder.ilike('description', ilike(query));
    requests.push(
      builder
        .order('occurred_at', { ascending: false })
        .limit(5)
        .abortSignal(signal)
        .then((result) =>
          (unwrap(result) || []).map((row) => ({
            kind: 'incident',
            id: row.id,
            number: row.number,
            title: row.description,
            plate: row.vehicles?.plate_number,
            path: `/fleet/incident/${row.id}`,
          })),
        ),
    );
  }
  return (await Promise.all(requests)).flat();
};

import fetchOrThrow from '../../common/util/fetchOrThrow';

const post = async (url, body) =>
  fetchOrThrow(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Creates a scheduled report (REP-08). With `calendarData` (from the schedule dialog) its Traccar
// calendar is created first, named like the report; `recipients` are other users who get it too.
export default async (deviceIds, groupIds, report) => {
  const { calendarData, recipients = [], name, ...fields } = report;
  let { calendarId } = fields;
  if (calendarData) {
    const calendar = await (await post('api/calendars', { name, data: calendarData })).json();
    calendarId = calendar.id;
  }
  const created = await (
    await post('api/reports', {
      ...fields,
      description: name ?? fields.description,
      calendarId,
      attributes: fields.attributes || {},
    })
  ).json();
  if (deviceIds.length) {
    await post(
      'api/permissions/bulk',
      deviceIds.map((id) => ({ deviceId: id, reportId: created.id })),
    );
  }
  if (groupIds.length) {
    await post(
      'api/permissions/bulk',
      groupIds.map((id) => ({ groupId: id, reportId: created.id })),
    );
  }
  if (recipients.length) {
    await post(
      'api/permissions/bulk',
      recipients.map((id) => ({ userId: id, reportId: created.id })),
    );
  }
  return created;
};

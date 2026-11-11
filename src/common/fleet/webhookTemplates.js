// INT-04: ready-made recipes for Make and Zapier on top of the signed webhooks. Each one picks
// the events, names the webhook, says which value to filter on in the scenario or zap, and
// carries a sample body so the tool can learn the fields before a real event happens.
// docs/INTEGRATIONS-TEMPLATES.md has the step-by-step guide for each.

const sample = (event, data) => ({
  event,
  occurred_at: '2026-11-10T08:30:00Z',
  data: { id: '6f1c2a90-0000-4000-8000-000000000001', created_at: '2026-11-10T08:30:00Z', ...data },
});

export const WEBHOOK_TEMPLATES = [
  {
    id: 'incidentToMonday',
    target: 'Monday',
    events: ['incidents.insert'],
    filter: null,
    sample: sample('incidents.insert', {
      number: 'INC-0142',
      type: 'collision',
      severity: 'minor',
      status: 'open',
      injuries: false,
      fault: 'other',
      occurred_at: '2026-11-10T08:12:00Z',
      vehicle_id: '6f1c2a90-0000-4000-8000-0000000000a1',
      driver_id: '6f1c2a90-0000-4000-8000-0000000000d1',
    }),
  },
  {
    id: 'documentToTasks',
    target: 'Google Tasks',
    events: ['document_alerts.insert'],
    filter: null,
    sample: sample('document_alerts.insert', {
      document_id: '6f1c2a90-0000-4000-8000-0000000000c1',
      threshold_days: 30,
      expires_at: '2026-12-10',
    }),
  },
  {
    id: 'deliveryToCustomer',
    target: 'WhatsApp / SMS',
    events: ['dispatch_jobs.status'],
    filter: { field: 'data.status', value: 'done' },
    sample: sample('dispatch_jobs.status', {
      number: 'JOB-2210',
      title: 'Delivery to Kfar Saba branch',
      type: 'delivery',
      status: 'done',
      address: 'Weizmann 120, Kfar Saba',
      completed_at: '2026-11-10T08:29:00Z',
    }),
  },
  {
    id: 'workOrderToSheet',
    target: 'Google Sheets',
    events: ['work_orders.status'],
    filter: { field: 'data.status', value: 'done' },
    sample: sample('work_orders.status', {
      number: 'WO-0388',
      title: '30,000 km service',
      type: 'service',
      status: 'done',
      closed_at: '2026-11-10T08:00:00Z',
      total_cost: 1240,
    }),
  },
  {
    id: 'inspectionToChat',
    target: 'Slack / Teams',
    events: ['inspections.insert'],
    filter: { field: 'data.result', value: 'fail' },
    sample: sample('inspections.insert', {
      result: 'fail',
      vehicle_id: '6f1c2a90-0000-4000-8000-0000000000a1',
      driver_id: '6f1c2a90-0000-4000-8000-0000000000d1',
      started_at: '2026-11-10T06:40:00Z',
      completed_at: '2026-11-10T06:44:00Z',
    }),
  },
  {
    id: 'violationToEmail',
    target: 'Gmail / Outlook',
    events: ['driver_violations.insert'],
    filter: null,
    sample: sample('driver_violations.insert', {
      type: 'speeding',
      status: 'open',
      occurred_at: '2026-11-08T17:20:00Z',
      points: 4,
      fine_amount: 750,
    }),
  },
];

export const templateOf = (id) => WEBHOOK_TEMPLATES.find((template) => template.id === id);

// The webhook form prefilled from a template; the URL comes from Make or Zapier.
export const webhookFromTemplate = (template, t) => ({
  name: t(`webhookTemplate_${template.id}`),
  url: '',
  events: [...template.events],
  active: true,
});

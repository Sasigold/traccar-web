// The resources of the public API, version 1 (INT-01): one source for the gateway, the OpenAPI
// document and the documentation screen in the app. The database side (which table, which columns
// are left out) is public.api_v1_resource() in supabase/migrations/20261111100000_public_api.sql;
// a unit test checks that the names agree. Plain JavaScript so Deno and Vite both import it.

const uuid = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const time = { type: 'string', format: 'date-time' };
const day = { type: 'string', format: 'date' };
const number = { type: 'number' };
const integer = { type: 'integer' };
const nullable = (schema) => ({ ...schema, nullable: true });

export const RESOURCES = [
  {
    name: 'vehicles',
    he: { title: 'רכבים', description: 'הרכבים של הארגון, עם מזהה המכשיר ב-Traccar.' },
    en: {
      title: 'Vehicles',
      description: "The organization's vehicles, with their Traccar device ID.",
    },
    fields: {
      id: uuid,
      traccar_device_id: integer,
      name: nullable(text),
      plate_number: nullable(text),
      vin: nullable(text),
      make: nullable(text),
      model: nullable(text),
      model_year: nullable(integer),
      status: nullable(text),
    },
  },
  {
    name: 'drivers',
    he: { title: 'נהגים', description: 'הנהגים, בלי מספר תעודת הזהות.' },
    en: { title: 'Drivers', description: 'Drivers, without their national ID number.' },
    fields: {
      id: uuid,
      traccar_driver_id: nullable(integer),
      full_name: nullable(text),
      phone: nullable(text),
      email: nullable(text),
      license_number: nullable(text),
      license_expiry: nullable(day),
      status: nullable(text),
    },
  },
  {
    name: 'assignments',
    he: { title: 'שיוך נהגים לרכבים', description: 'איזה נהג נהג באיזה רכב, ומתי.' },
    en: { title: 'Driver assignments', description: 'Which driver drove which vehicle, and when.' },
    changed: 'starts_at',
    fields: {
      id: uuid,
      vehicle_id: uuid,
      driver_id: uuid,
      starts_at: time,
      ends_at: nullable(time),
    },
  },
  {
    name: 'documents',
    he: { title: 'מסמכים', description: 'מסמכי רכבים ונהגים ותאריכי התוקף שלהם, בלי הקבצים.' },
    en: {
      title: 'Documents',
      description: 'Vehicle and driver documents and their expiry dates, without the files.',
    },
    fields: {
      id: uuid,
      vehicle_id: nullable(uuid),
      driver_id: nullable(uuid),
      document_type: nullable(text),
      title: nullable(text),
      issued_at: nullable(day),
      expires_at: nullable(day),
    },
  },
  {
    name: 'work_orders',
    he: { title: 'הזמנות עבודה', description: 'טיפולים ותיקונים במוסך, עם העלות.' },
    en: {
      title: 'Work orders',
      description: 'Service and repairs at the garage, with their cost.',
    },
    fields: {
      id: uuid,
      number: integer,
      vehicle_id: uuid,
      vendor_id: nullable(uuid),
      title: text,
      type: text,
      status: text,
      opened_at: time,
      closed_at: nullable(time),
      odometer_km: nullable(number),
      total_cost: nullable(number),
    },
  },
  {
    name: 'issues',
    he: { title: 'תקלות', description: 'תקלות שדווחו ברכבים, מבדיקה או מנהג.' },
    en: {
      title: 'Issues',
      description: 'Faults reported on vehicles, from an inspection or a driver.',
    },
    fields: {
      id: uuid,
      vehicle_id: uuid,
      source: text,
      severity: text,
      title: text,
      status: text,
      work_order_id: nullable(uuid),
      resolved_at: nullable(time),
    },
  },
  {
    name: 'inspections',
    he: { title: 'בדיקות רכב', description: 'בדיקות בוקר ובדיקות תקופתיות והתוצאה שלהן.' },
    en: { title: 'Inspections', description: 'Morning and periodic checks and their result.' },
    fields: {
      id: uuid,
      vehicle_id: uuid,
      driver_id: nullable(uuid),
      template_name: nullable(text),
      started_at: time,
      finished_at: nullable(time),
      odometer_km: nullable(number),
      result: text,
    },
  },
  {
    name: 'incidents',
    he: { title: 'תאונות ואירועים', description: 'תאונות, נזקים וגניבות, עם החומרה ועלות התיקון.' },
    en: {
      title: 'Incidents',
      description: 'Accidents, damage and theft, with severity and repair cost.',
    },
    fields: {
      id: uuid,
      number: integer,
      vehicle_id: uuid,
      driver_id: nullable(uuid),
      occurred_at: time,
      type: text,
      severity: text,
      injuries: { type: 'boolean' },
      fault: text,
      status: text,
      repair_cost: nullable(number),
    },
  },
  {
    name: 'fuel',
    he: { title: 'תדלוקים', description: 'תדלוקים מכרטיסי הדלק או מהזנה ידנית.' },
    en: { title: 'Fuel', description: 'Fuel purchases from fuel cards or entered by hand.' },
    fields: {
      id: uuid,
      vehicle_id: nullable(uuid),
      driver_id: nullable(uuid),
      occurred_at: time,
      station: nullable(text),
      fuel_type: nullable(text),
      liters: nullable(number),
      unit_price: nullable(number),
      total: number,
      odometer_reported: nullable(number),
      anomaly_flags: { type: 'array', items: text },
    },
  },
  {
    name: 'expenses',
    he: { title: 'הוצאות', description: 'הוצאות רכב אחרות: ביטוח, אגרות, חניה, כבישי אגרה ועוד.' },
    en: {
      title: 'Expenses',
      description: 'Other vehicle expenses: insurance, fees, parking, tolls.',
    },
    fields: {
      id: uuid,
      vehicle_id: uuid,
      driver_id: nullable(uuid),
      category: text,
      occurred_at: day,
      amount: number,
      reference: nullable(text),
    },
  },
  {
    name: 'monthly_costs',
    he: {
      title: 'עלויות חודשיות',
      description: 'סכום העלויות לכל רכב, חודש וקטגוריה (דלק, טיפולים ושאר ההוצאות).',
    },
    en: {
      title: 'Monthly costs',
      description: 'Costs per vehicle, month and category (fuel, maintenance and other expenses).',
    },
    changed: 'month',
    fields: { vehicle_id: uuid, month: day, category: text, amount: number },
  },
  {
    name: 'violations',
    he: { title: 'עבירות ודוחות', description: 'דוחות תנועה וחניה, הקנס והמועד להסבה לנהג.' },
    en: {
      title: 'Violations',
      description: 'Traffic and parking tickets, the fine and the deadline to transfer them.',
    },
    fields: {
      id: uuid,
      driver_id: nullable(uuid),
      vehicle_id: nullable(uuid),
      occurred_at: time,
      type: text,
      fine_amount: nullable(number),
      points: nullable(integer),
      status: text,
      due_at: nullable(day),
    },
  },
  {
    name: 'dispatch_jobs',
    he: { title: 'משימות שיגור', description: 'משימות ללקוחות, מי ביצע ומתי.' },
    en: { title: 'Dispatch jobs', description: 'Jobs for customers, who did them and when.' },
    fields: {
      id: uuid,
      number: integer,
      title: text,
      type: text,
      status: text,
      priority: text,
      customer_name: nullable(text),
      address: nullable(text),
      vehicle_id: nullable(uuid),
      driver_id: nullable(uuid),
      scheduled_at: nullable(time),
      completed_at: nullable(time),
    },
  },
];

export const RESOURCE_NAMES = RESOURCES.map((resource) => resource.name);

export const resourceOf = (name) => RESOURCES.find((resource) => resource.name === name) ?? null;

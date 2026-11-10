// Roadmap stage 2: vehicle inspections / checklists (pure, unit-tested).

export const ITEM_TYPES = ['pass_fail', 'number_range', 'photo', 'text', 'signature'];
export const FREQUENCIES = ['per_trip', 'daily', 'weekly', 'monthly', 'quarterly'];

// A starting checklist for a daily vehicle check, in Hebrew (the default UI language).
export const DEFAULT_CHECKLIST = [
  { label: 'צמיגים: לחץ אוויר ומצב', type: 'pass_fail', critical: true },
  { label: 'בלמים ובלם יד', type: 'pass_fail', critical: true },
  { label: 'אורות ראשיים, איתות ובלימה', type: 'pass_fail', critical: true },
  { label: 'מראות', type: 'pass_fail', critical: false },
  { label: 'מגבים ונוזל שמשות', type: 'pass_fail', critical: false },
  { label: 'שמן מנוע ונוזל קירור', type: 'pass_fail', critical: false },
  { label: 'צופר', type: 'pass_fail', critical: false },
  { label: 'חגורות בטיחות', type: 'pass_fail', critical: true },
  { label: 'מטף כיבוי אש', type: 'pass_fail', critical: true },
  { label: 'ערכת עזרה ראשונה ומשולש אזהרה', type: 'pass_fail', critical: false },
  { label: 'רישיון רכב ותעודת ביטוח ברכב', type: 'pass_fail', critical: false },
  { label: 'נזק חיצוני חדש (תמונה)', type: 'photo', critical: false },
];

// passed: true / false, or null when the answer doesn't decide (text, photo, empty).
export const evaluateItem = (item, value) => {
  if (item.type === 'pass_fail') {
    if (value === 'pass') return true;
    if (value === 'fail') return false;
    return null;
  }
  if (item.type === 'number_range') {
    if (value === '' || value == null || Number.isNaN(Number(value))) return null;
    const number = Number(value);
    const low = item.min_value == null ? -Infinity : Number(item.min_value);
    const high = item.max_value == null ? Infinity : Number(item.max_value);
    return number >= low && number <= high;
  }
  return null;
};

// Every pass/fail and range item must be answered before the inspection can be submitted.
export const missingAnswers = (items, answers) =>
  items.filter(
    (item) =>
      (item.type === 'pass_fail' || item.type === 'number_range' || item.type === 'signature') &&
      (answers[item.id]?.value === undefined ||
        answers[item.id]?.value === '' ||
        answers[item.id]?.value === null),
  );

export const inspectionResult = (items, answers) =>
  items.some((item) => evaluateItem(item, answers[item.id]?.value) === false) ? 'fail' : 'pass';

// ADM-11: a failed critical item needs a photo and a comment, so the manager sees what is wrong.
export const criticalWithoutEvidence = (items, answers) =>
  items.filter(
    (item) =>
      item.critical &&
      evaluateItem(item, answers[item.id]?.value) === false &&
      (!answers[item.id]?.photo || !answers[item.id]?.comment?.trim()),
  );

export const failedCritical = (items, answers) =>
  items.some((item) => item.critical && evaluateItem(item, answers[item.id]?.value) === false);

// "All OK": every unanswered pass/fail item passes; the answers given stay.
export const allPassing = (items, answers) => {
  const next = { ...answers };
  items.forEach((item) => {
    if (item.type === 'pass_fail' && next[item.id]?.value === undefined) {
      next[item.id] = { ...next[item.id], value: 'pass' };
    }
  });
  return next;
};

// One issue per failed item; a critical item is a critical issue, which keeps the vehicle off
// the road until it is resolved (vehicle_out_of_service).
export const issuesFromFailures = (items, answers) =>
  items
    .filter((item) => evaluateItem(item, answers[item.id]?.value) === false)
    .map((item) => ({
      title: item.label,
      description: answers[item.id]?.comment || null,
      severity: item.critical ? 'critical' : 'medium',
      source: 'inspection',
    }));

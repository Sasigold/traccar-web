// BRD-04: the report columns that hold figures; they line up at the end of the cell (MUI's
// "right" becomes the left in RTL), like in the newer reports.
export const NUMERIC_COLUMNS = new Set([
  'distance',
  'averageSpeed',
  'maxSpeed',
  'duration',
  'spentFuel',
  'startOdometer',
  'endOdometer',
  'engineHours',
  'odometer',
  'startHours',
  'endHours',
  // Times are figures too, and read best lined up.
  'startTime',
  'endTime',
]);

export const alignOf = (key) => (NUMERIC_COLUMNS.has(key) ? 'right' : undefined);

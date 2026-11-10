import dayjs from 'dayjs';

// ADM-24: dates can be typed, not only picked: "15032027" becomes "15/03/2027" as it is typed.
// `order` is the locale's day/month order from its 'L' format ('DMY' in Hebrew, 'MDY' in English).
export const dateOrder = (localeFormat = 'DD/MM/YYYY') => {
  const day = localeFormat.indexOf('D');
  const month = localeFormat.indexOf('M');
  return day >= 0 && month >= 0 && month < day ? 'MDY' : 'DMY';
};

// Digits only, with the separators put in after the day and the month.
export const maskDate = (text) => {
  const digits = String(text || '')
    .replace(/\D/g, '')
    .slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
};

// A complete typed date as 'YYYY-MM-DD', or null when it is not a real day.
export const parseTypedDate = (text, order = 'DMY') => {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(String(text || '').trim());
  if (!match) return null;
  const [first, second, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const [day, month] = order === 'MDY' ? [second, first] : [first, second];
  const date = dayjs(new Date(year, month - 1, day));
  if (date.date() !== day || date.month() !== month - 1 || year < 1900 || year > 2200) return null;
  return date.format('YYYY-MM-DD');
};

// Renewal shortcuts: the same date a year (or six months) later.
export const addToDate = (value, amount, unit) => {
  const date = value ? dayjs(value) : dayjs();
  return date.add(amount, unit).format('YYYY-MM-DD');
};

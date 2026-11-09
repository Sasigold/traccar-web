import { describe, expect, it } from 'vitest';
import he from '../l10n/he.json';

// The Hebrew glossary (BRAND.md, "מונחים"): one word for each thing, addressed to the user in the
// plural. Variants that crept in before are listed here so they do not come back.
const banned = [
  [/התנעה במקום/, 'idling is "סרק"'],
  [/הפעלה חוזרת/, 'replay is "שחזור מסלול"'],
  [/דורש טיפול/, '"דורש פעולה" ("טיפול" reads as a garage visit)'],
  [/הנהג שלי/, 'the driver section is "אזור הנהג"'],
  [/נותרו \{0\} ימים|\{0\} ימים נותרו/, 'use "עוד {0}" with formatDays (יום אחד, יומיים)'],
  [
    /^(בחר|בדוק|הזן|שמור|הוסף|ערוך|מחק|התחבר|הירשם) /,
    'address the user in the plural (בחרו, בדקו…)',
  ],
  [/(^| )לחץ על /, 'address the user in the plural (לחצו על)'],
];

describe('Hebrew terminology', () => {
  banned.forEach(([pattern, rule]) => {
    it(rule, () => {
      const hits = Object.entries(he)
        .filter(([, value]) => pattern.test(value))
        .map(([key, value]) => `${key}: ${value}`);
      expect(hits).toEqual([]);
    });
  });
});

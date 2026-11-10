// The accessibility statement (A11-07), one text for the app (/accessibility) and the website
// (accessibility.html). Required for internet services by the Equal Rights for Persons with
// Disabilities (Service Accessibility Adjustments) Regulations, 2013. The coordinator's details
// come from the server settings (app) or website/src/config.js (site).
//
// Updated: when the product changes what is or is not accessible, change the text and the date.

export const STATEMENT_UPDATED = '2026-11-14';

const he = {
  title: 'הצהרת נגישות',
  sections: [
    {
      title: 'המחויבות שלנו',
      paragraphs: [
        'viper fleet היא מערכת לניהול ומעקב צי רכב. אנחנו רוצים שכל אחד ואחת יוכלו להשתמש בה, כולל אנשים עם מוגבלות, ופועלים לכך בכל שינוי במערכת.',
      ],
    },
    {
      title: 'רמת הנגישות',
      paragraphs: [
        'המערכת והאתר הותאמו לתקן הישראלי ת"י 5568, שמבוסס על הנחיות WCAG 2.1 ברמה AA, למעט החריגים שבהמשך.',
      ],
    },
    {
      title: 'מה עשינו',
      items: [
        'כל מסך נבדק אוטומטית מול WCAG 2.1 AA (axe) בכל שינוי בקוד, במחשב ובטלפון.',
        'אפשר לעבוד עם המקלדת בלבד: דילוג לתוכן, סדר מעבר הגיוני, מיקוד גלוי וקיצורי מקשים.',
        'לכפתורים, לשדות ולחלונות יש שמות שקוראי מסך מקריאים, והודעות חשובות מוכרזות.',
        'ניגודיות צבעים לפי התקן, מצב כהה, והגדלת טקסט עד 200% בלי לאבד תוכן.',
        'עברית מימין לשמאל כברירת מחדל, ואנגלית.',
        'מי שביקש מהדפדפן להפחית תנועה מקבל מסכים בלי אנימציות.',
      ],
    },
    {
      title: 'מה עוד לא נגיש במלואו',
      items: [
        'המפה עצמה היא תמונה גרפית. החלופה: רשימת הרכבים וכרטיס הרכב מציגים את אותו מידע בטקסט.',
        'גרפים בדוחות ובדשבורד: הנתונים שלהם זמינים בטבלה ובייצוא לאקסל.',
        'וידאו חי ממצלמות הרכב מוצג בלי כתוביות.',
        'קובצי PDF שהמערכת מפיקה (מכתבים ודוחות להדפסה) עשויים שלא להיות נגישים במלואם. אפשר לבקש אותם בפורמט אחר.',
      ],
    },
    {
      title: 'נתקלתם בבעיה?',
      paragraphs: [
        'נשמח לשמוע ולתקן. פנו לרכז הנגישות ונחזור אליכם תוך 5 ימי עבודה. אפשר לבקש כל מידע מהמערכת בדרך אחרת שנוחה לכם.',
      ],
      contact: true,
    },
  ],
  coordinator: 'רכז הנגישות',
  phone: 'טלפון',
  email: 'אימייל',
  notSet: 'פרטי הרכז יפורסמו כאן בקרוב. עד אז אפשר לפנות דרך מנהל המערכת בארגון שלכם.',
  updated: 'עודכן לאחרונה',
};

const en = {
  title: 'Accessibility statement',
  sections: [
    {
      title: 'Our commitment',
      paragraphs: [
        'viper fleet is a fleet management and tracking system. We want everyone to be able to use it, including people with disabilities, and work on it with every change.',
      ],
    },
    {
      title: 'Level of accessibility',
      paragraphs: [
        'The system and the website follow Israeli Standard 5568, based on WCAG 2.1 level AA, except for the items below.',
      ],
    },
    {
      title: 'What we did',
      items: [
        'Every screen is checked automatically against WCAG 2.1 AA (axe) with every code change, on desktop and phone.',
        'Everything works from the keyboard: skip to content, a logical tab order, visible focus and shortcuts.',
        'Buttons, fields and dialogs have names screen readers read, and important messages are announced.',
        'Color contrast as the standard requires, a dark mode, and text enlarged to 200% without losing content.',
        'Hebrew right to left by default, and English.',
        'Users who asked their browser to reduce motion get screens without animation.',
      ],
    },
    {
      title: 'Not fully accessible yet',
      items: [
        'The map itself is a picture. The alternative: the vehicle list and the vehicle card give the same information as text.',
        'Charts in reports and the dashboard: their data is available as a table and in the Excel export.',
        'Live video from vehicle cameras has no captions.',
        'PDF files the system produces (letters and reports to print) may not be fully accessible. They can be requested in another format.',
      ],
    },
    {
      title: 'Found a problem?',
      paragraphs: [
        'We want to hear and fix it. Contact the accessibility coordinator and we will answer within 5 working days. Any information in the system can be requested in another way that suits you.',
      ],
      contact: true,
    },
  ],
  coordinator: 'Accessibility coordinator',
  phone: 'Phone',
  email: 'E-mail',
  notSet:
    "The coordinator details will be published here soon. Until then, contact your organization's system administrator.",
  updated: 'Last updated',
};

export const accessibilityStatement = (language) => (language === 'he' ? he : en);

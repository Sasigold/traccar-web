# התקדמות מפת הדרכים: מאיפה ממשיכים

הקובץ הזה הוא נקודת ההמשך. מי שממשיך את הפיתוח (אדם או סוכן AI) קורא אותו קודם, ואחר כך את
`docs/roadmap/ITEMS.md`, שבו כל 213 הפריטים של דוח הסקירה עם המצב של כל אחד.

עודכן: 9 בנובמבר 2026, אחרי FND-07 (commit `FND-07_COMMIT`), בענף `claude/clever-edison-f9609a`.

## ההוראה של הבעלים

"לבצע את כל השינויים שהוצעו בדוח, אחד אחרי השני, לפי הסדר, לאט לאט, בלי לעשות טעויות."
כל סעיף: קוד, מחרוזות בעברית ובאנגלית, בדיקות (יחידה, מסד, e2e לפי הצורך), בדיקה ויזואלית בעברית/RTL,
בהיר וכהה, מחשב וטלפון, ואז lint, הרצה מלאה וקומיט נפרד לכל סעיף עם המזהה בכותרת
(למשל `FND-06: ...`).

## הבא בתור

סדר הביצוע הוא מפת הדרכים של הדוח. שלב "1 עד 3 חודשים" כמעט הסתיים; נשארו בו:

1. **ARC-06, שכבת נתונים משותפת.** TanStack Query גם ל-Traccar וגם ל-Supabase, `signal` מחובר ל-
   `.abortSignal()`, `invalidateQueries` במקום `reloadKey`, מפתחות עם `orgId`. מעבר הדרגתי.

אחריהם, לפי הדוח:

- **3 עד 6 חודשים:** AI-01 עד AI-04, SAF-01, SAF-02, OPS-02, LIV-09, ADM-10, INT-03, BIZ-02, BIZ-06,
  A11-10.
- **6 עד 12 חודשים:** SAF-03, AI-05, OPS-03, INT-02, ISR-07, BIZ-05, AI-09, LIV-26 עד LIV-28.
- כל שאר הפריטים ב-`ITEMS.md` שמסומנים ⬜ (P2 ו-P3 בעיקר), לפי העדיפות.

## מה נשאר פתוח בסעיפים שבוצעו

- **REP-23:** נעשו ציר זמן יומי, שימוש, עלות לק"מ ותקינות מכשירים. חסרים: עמידה במשימות, שרשרת
  קירור, מכסת ליסינג, דוח הנהלה חודשי ב-PDF.
- **INT-01:** API לקריאה בלבד. חסרים: כתיבה, מיקומים ונסיעות מ-Traccar (צריך חשבון שירות ב-Vault),
  פיד OData, שרת MCP (AI-07).
- **BIZ-01:** רק Morning. חסרים: iCount ורווחית, חשבוניות זיכוי, סולק אחר. Morning עובר ל-OAuth;
  הפונקציה משתמשת ב-`/account/token` מהאוסף הרשמי שלהם, לבדוק לפני שימוש אמיתי.
- **ISR-04:** קצין בטיחות חיצוני לכמה ארגונים, ופענוח קובצי טכוגרף.
- **REP-08:** תזמון חודשי (יש יומי ושבועי).
- **FND-04:** תצוגה מקדימה לכל PR (היה אופציונלי).
- **FND-07:** בדיקות RTL כרגע ל-SocketController, לרשימה, לכרטיס הרכב, ל-EditItemView ול-adminApi.
  כשנוגעים בקומפוננטה מסוכנת אחרת, להוסיף לה `*.test.jsx` באותו דפוס. מספרי הביצועים נמדדו בלי GPU;
  לאשר פעם אחת על מחשב משרדי ועל טלפון בינוני (`docs/PERFORMANCE.md`).
- **FND-06:** הקוד מוכן ומחכה להחלטות של הבעלים (ראו למטה). מדדי הדפדפן והמונים כבר נשלחים למסד הצי
  ונראים ב-`/admin/health`. אפשר להוסיף בעתיד: אירועי שימוש לפעולות מפתח (`trackEvent` ב-
  `src/common/telemetry/install.js` מוכן), פירוק מדדים לפי מסך, והתראה כשמונה קופץ אחרי פריסה.

## מה מחכה לבעלים (לא בקוד)

1. פריסה לייצור: ידנית, Actions ← "Promote to production" (מקלידים `production`). מריצה מיגרציות
   (עם גיבוי) ופורסת את ה-edge functions. דחיפה ל-`main` כבר לא מעלה לייצור.
2. staging לפי `deploy/STAGING.md` ומשתני `STAGING_*` ב-GitHub. אחרי שהוא קם, `DB_CONTAINER` בשורת
   ה-cron של הגיבוי.
3. גיבוי לילי: `deploy/backup.sh` ב-cron על השרת, עם העתקה מחוץ לשרת.
4. מאשרים לסביבת production ב-GitHub.
5. מפתחות ספקי השליחה (OPS-01) במסך ערוצי השליחה.
6. Morning: מפתח API, חיבור לרשות המסים, Cardcom ו-`BILLING_DOCUMENTS_URL` לתשלום באשראי.
7. הגדרות בשרת Traccar: `database.historyDays` וסינון דוחות מתוזמנים (SEC-02, SEC-12).
8. תצפיתיות (FND-06, `docs/OBSERVABILITY.md`): להחליט GlitchTip על ה-VPS או Sentry, ואיזו אנליטיקה
   (Umami, Plausible, PostHog או בלי). אחר כך משתני `STAGING_ERROR_DSN` / `PRODUCTION_ERROR_DSN`,
   `*_ANALYTICS_PROVIDER/URL/SITE`, ולמפות המקור: `ERROR_SOURCEMAPS_URL`, `ERROR_SOURCEMAPS_ORG`,
   `*_ERROR_PROJECT` והסוד `ERROR_AUTH_TOKEN`. עם אנליטיקה: שורה בהודעת הפרטיות. עם CSP (SEC-10):
   להוסיף את שני השירותים ל-`connect-src`.

## איך עובדים כאן

- **CLAUDE.md ו-BRAND.md מחייבים.** צבעים רק מ-`theme.palette`, בלי טקסט aqua על רקע בהיר, פעולה ראשית
  אחת, Sora ו-Assistant, מאפיינים לוגיים ל-RTL, כל מחרוזת ב-`he.json` וגם ב-`en.json`, פנייה ברבים
  ובלשון ניטרלית, מונח אחד לכל דבר (ראו את המילון ב-BRAND.md).
- **בדיקות:**
  - `npm run lint` (לבדוק את קוד היציאה, לא רק את הזנב של הפלט).
  - `npm test` (vitest, סביבת node; `window` דרך `vi.stubGlobal`). כולל גם `supabase/functions/**`.
  - בדיקות מסד: Postgres 16 מקומי ואז `PGHOST=... PGPORT=... PGUSER=postgres sh supabase/tests/run.sh`.
    בדיקות עוברות בין משתמשים עם `pg_temp.as_user(id)`. לבדוק שבדיקה חדשה נכשלת כשמקלקלים את הקוד.
  - בדיקות קומפוננטות: קובץ `*.test.jsx` שמתחיל ב-`// @vitest-environment jsdom`, עם `renderApp` ו-
    `fakeFetch` מ-`src/test/render.jsx` (store, תרגומים, theme ו-router כמו באפליקציה), ו-
    `createFakeSupabase` מ-`src/test/fakeSupabase.js`.
  - `npm run test:e2e -- --trace off` (Playwright מול שרת הדמו, דסקטופ וטלפון, כולל axe ל-WCAG 2.1 AA).
    לא לערוך קבצים ב-`src` בזמן הרצה מלאה (HMR של Vite גורם לכשלים מקריים).
  - תרחישים ששומרים: `writeMode(page)` ו-`fakeFleet(page, {...})` מ-`e2e/fakeFleet.js` (ארגז חול לכתיבה
    בדמו, traccar-auth מזויף, PostgREST ו-Storage בזיכרון). דוגמה: `e2e/scenarios.spec.js`.
  - פרופיל ביצועים של 2,000 רכבים: `e2e/performance.spec.js`, ו-`docs/PERFORMANCE.md` (גם מול build של
    ייצור: `npm run demo:build` ו-`npm run demo:preview`).
- **הדמו:** `npm run demo` על פורט 3000. מסד הצי בדמו הוא `https://fleet.demo.invalid` (לא קיים), ובדיקות
  e2e מזייפות אותו עם `FLEET` מ-`e2e/fixtures.js` (traccar-auth שמחזיר הרשאות, ותשובות PostgREST).
  משתמש הדמו לקריאה בלבד; בדיקה שכותבת משתמשת ב-`writeMode(page)` (קוקי `demoWrite`, ראו `demo/sandbox.js`).
- **סביבות ופריסה:** `deploy/STAGING.md` (סביבות, staging, גרסאות וחזרה לאחור).
- **תצפיתיות:** `docs/OBSERVABILITY.md`. מונה חדש: `countEvent('name')` מ-`src/common/telemetry/metrics.js`
  (בלי פרטים אישיים בשם), ולהוסיף לו תווית ב-`ClientHealthPage.jsx`.
- **build:** צריך `VITE_FLEET_URL` ו-`VITE_FLEET_ANON_KEY` (בלי ברירת מחדל של ייצור, FND-04).
- **סודות:** רק ב-Vault (פונקציות `*_set_secret` שרק מנהלי הפלטפורמה מריצים), אף פעם לא בטבלאות, במשתני
  סביבה של הקוד או בגיט. אין גישת SSH לשרת מהסביבה הזו; פעולות בשרת עוברות דרך ה-workflows.
- **סיכום חזותי של מה שבוצע** (עם 236 צילומי מסך): artifact "viper fleet: מה בוצע עד עכשיו"
  (slug `dff73e7c-28be-4669-acea-4ca227d0cfb8`).

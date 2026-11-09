# התקדמות מפת הדרכים: מאיפה ממשיכים

הקובץ הזה הוא נקודת ההמשך. מי שממשיך את הפיתוח (אדם או סוכן AI) קורא אותו קודם, ואחר כך את
`docs/roadmap/ITEMS.md`, שבו כל 213 הפריטים של דוח הסקירה עם המצב של כל אחד.

עודכן: 15 בנובמבר 2026, אחרי OPS-02 (כל פריטי P1 בוצעו), בענף `claude/clever-edison-f9609a`.

## ההוראה של הבעלים

"לבצע את כל השינויים שהוצעו בדוח, אחד אחרי השני, לפי הסדר, לאט לאט, בלי לעשות טעויות."
כל סעיף: קוד, מחרוזות בעברית ובאנגלית, בדיקות (יחידה, מסד, e2e לפי הצורך), בדיקה ויזואלית בעברית/RTL,
בהיר וכהה, מחשב וטלפון, ואז lint, הרצה מלאה וקומיט נפרד לכל סעיף עם המזהה בכותרת
(למשל `FND-06: ...`).

## הבא בתור

כל פריטי P1 בוצעו (חלקם חלקית, ראו למטה). הסבב האחרון: REP-07, REP-05, LIV-10, LIV-09, ADM-10, ADM-13,
ARC-06, AI-03, AI-01, AI-04, AI-02, SAF-01, SAF-02, OPS-02. ממשיכים ב-P2 ואז P3 לפי הסדר ב-ITEMS.md
(⬜ עם P2).

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
- **SEC-06, ARC-05:** סנכרון ההרשאות מול Traccar עדיין רץ מהדפדפן (עם אימות, מקביליות מוגבלת והתאמה
  מלאה). תור בשרת (Edge Function + outbox) צריך חשבון שירות ב-Traccar, כמו INT-01.
- **SEC-11:** הקוד והתיעוד מוכנים; השינוי עצמו בשרת (ראו למטה).
- **FND-07:** בדיקות RTL כרגע ל-SocketController, לרשימה, לכרטיס הרכב, ל-EditItemView ול-adminApi.
  כשנוגעים בקומפוננטה מסוכנת אחרת, להוסיף לה `*.test.jsx` באותו דפוס. מספרי הביצועים נמדדו בלי GPU;
  לאשר פעם אחת על מחשב משרדי ועל טלפון בינוני (`docs/PERFORMANCE.md`).
- **FND-06:** הקוד מוכן ומחכה להחלטות של הבעלים (ראו למטה). מדדי הדפדפן והמונים כבר נשלחים למסד הצי
  ונראים ב-`/admin/health`. אפשר להוסיף בעתיד: אירועי שימוש לפעולות מפתח (`trackEvent` ב-
  `src/common/telemetry/install.js` מוכן), פירוק מדדים לפי מסך, והתראה כשמונה קופץ אחרי פריסה.

- **REP-05:** מסנן נהג בדשבורד (יש בדוח הנסיעות).
- **LIV-10:** סימוני אירועים על ציר הזמן של השחזור.
- **LIV-09:** פריסה של שני טורים לטאבלט.
- **ADM-10:** בדיקת הבוקר עדיין לא עוברת דרך תור השליחה (דיווח הנזק כן).
- **ADM-13:** שיוך של כמה רכבים ללקוח בבת אחת.
- **ARC-06:** ה-hooks המשותפים של הצי עברו ל-TanStack Query (`docs/DATA.md`); כ-30 מסכים עוד קוראים
  ישירות. מעבירים כשנוגעים בהם.
- **AI-01:** "הפיכה להתראה" מתשובה. **AI-02:** ווידג'ט בדשבורד ותקציר בוקר בוואטסאפ.
- **SAF-01:** הציון בדשבורד עוד סופר אירועים שנדחו. **SAF-02:** התראה חיה כשרכב נוסע בלי נהג (צריך בדיקה
  בצד השרת).

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
9. כותרות אבטחה ב-reverse proxy (SEC-10): `sh deploy/security-headers.sh traefik` (או nginx / caddy) והדבקה
   בהגדרות, לפי `deploy/SECURITY-HEADERS.md`.
10. הקשחת השרת (SEC-11, SEC-19): פורט 8082 רק על 127.0.0.1, חומת אש לפורטי המכשירים, להריץ
    `sh deploy/check-exposure.sh 72.61.153.60 https://traccar-ovjj.srv2122641.hstgr.cloud` ממחשב רגיל, ולמלא את
    רשימת הבדיקה ב-`deploy/SERVER-HARDENING.md`.
11. פרטיות (SEC-12): בדיקה של עורך דין להודעה לעובדים, להסכמה ולמרשם פעילויות העיבוד (מסך הפרטיות ›
    בקשות של עובדים); `database.historyDays` ב-Traccar לפי מדיניות השמירה.
12. נגישות (A11-07): פרטי רכז נגישות בהגדרות השרת (`accessibilityContact`, `accessibilityPhone`,
    `accessibilityEmail`) ובאתר (`website/src/config.js` › `site.accessibility`), ובדיקת הנוסח מול יועץ נגישות.
13. AI (AI-01 עד AI-04, `docs/AI.md`): מפתח API של Anthropic ב-Vault (מסך הגדרות › AI, או
    `select public.ai_set_secret('...')`), פריסת הפונקציה `fleet-ai` (`sh deploy/functions.sh`), ושורה על ספק
    ה-AI במרשם העיבוד ובבדיקת עורך הדין.
14. בדיקות דלק (OPS-02): מחיר הליטר המפוקח בכל חודש במסך בדיקות הדלק.
15. צ'ק-אין לנהגים (SAF-02): להדפיס את קוד ה-QR של כל רכב (דף הרכב) ולהדביק בתא הנהג.

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

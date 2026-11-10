# תבניות מוכנות ל-Make ול-Zapier (INT-04)

ב"צי ← חיבורים ← Webhooks" יש שש תבניות. כל תבנית בוחרת את האירועים ונותנת שם ל-Webhook. נשאר רק
להדביק את הכתובת שהכלי נותן. הרשימה עצמה נמצאת ב-`src/common/fleet/webhookTemplates.js`.

| תבנית | אירוע | סינון בתרחיש | יעד |
| --- | --- | --- | --- |
| תאונה חדשה: כרטיס ב-Monday | `incidents.insert` | אין | Monday: Create Item |
| תוקף מסמך מתקרב: משימה | `document_alerts.insert` | אין | Google Tasks: Create Task |
| משלוח נמסר: הודעה ללקוח | `dispatch_jobs.status` | `data.status = done` | WhatsApp Business / SMS |
| הזמנת עבודה נסגרה: שורה בגיליון | `work_orders.status` | `data.status = done` | Google Sheets: Add Row |
| בדיקת בוקר נכשלה: הודעה בצ'אט | `inspections.insert` | `data.result = fail` | Slack / Microsoft Teams |
| עבירת תנועה חדשה: מייל למנהל | `driver_violations.insert` | אין | Gmail / Outlook |

## מה מגיע בכל קריאה

```json
{
  "event": "work_orders.status",
  "occurred_at": "2026-11-10T08:30:00Z",
  "data": { "id": "…", "number": "WO-0388", "status": "done", "total_cost": 1240 }
}
```

ב-`data` יש רק רשימת שדות קבועה לכל טבלה (SEC-15). אין בו טלפונים, תעודות זהות, טוקנים או הערות.
רכב ונהג מגיעים כמזהים (`vehicle_id`, `driver_id`). כדי להציג שם, מוסיפים בתרחיש קריאה ל-API
הציבורי (`GET /v1/vehicles/{id}`, ראו "תיעוד API" במסך החיבורים).

הכותרות:

- `X-ViperFleet-Event`: שם האירוע.
- `X-ViperFleet-Delivery`: מזהה המשלוח. אם אותו מזהה מגיע פעמיים, מתעלמים ממנו.
- `X-ViperFleet-Timestamp`: שניות מאז 1970.
- `X-ViperFleet-Signature`: `v1=` ואחריו HMAC-SHA256 בהקס של `<timestamp>.<body>`, עם הסוד של ה-Webhook.

## Make

1. ב-Make: Create a new scenario ← **Webhooks ← Custom webhook** ← Add. נותנים שם ומעתיקים את הכתובת.
2. ב-viper fleet: Webhooks ← "שימוש בתבנית" ליד התבנית ← מדביקים את הכתובת ← שמירה.
3. ב-Make לוחצים **Redetermine data structure**. ב-viper fleet לוחצים "העתקת דוגמה", ושולחים את
   הדוגמה לכתובת (למשל `curl -X POST -H 'Content-Type: application/json' -d @sample.json <url>`).
   מעכשיו Make מכיר את השדות.
4. אם בטבלה למעלה יש סינון, מוסיפים אחרי הטריגר **Filter** עם התנאי (למשל `data.status` Equal to `done`).
5. מוסיפים את מודול היעד וממפים את השדות (למשל `data.number` לשם הפריט ב-Monday).
6. מפעילים את התרחיש (ON). אירוע אמיתי יופיע ב-viper fleet בלשונית "משלוחים" כ"נשלח".

## Zapier

1. ב-Zapier: Create Zap ← טריגר **Webhooks by Zapier ← Catch Hook**. מעתיקים את הכתובת.
2. ב-viper fleet: "שימוש בתבנית" ← מדביקים ← שמירה.
3. שולחים את הדוגמה (כמו בשלב 3 של Make) ולוחצים ב-Zapier **Test trigger**.
4. כשיש סינון: מוסיפים **Filter by Zapier** עם התנאי (`Data Status` exactly matches `done`).
5. מוסיפים את פעולת היעד, ממפים ומפעילים את ה-Zap.

## אימות החתימה (מומלץ)

Webhooks by Zapier ו-Custom webhook של Make מקבלים כל קריאה. כדי לוודא שהקריאה באה מ-viper fleet:

- **Make:** אחרי הטריגר מוסיפים **Tools ← Set variable** עם
  `sha256(timestamp + "." + body; "hex"; secret)`, כש-body הוא הגוף הגולמי. בשביל זה מפעילים
  בהגדרות המתקדמות של הטריגר את **JSON pass-through** (הגוף מגיע כטקסט) ואת **Get request
  headers**, ומפענחים את הגוף עם **JSON ← Parse JSON** לפני המיפוי. אחר כך Filter שמשווה ל-`X-ViperFleet-Signature` בלי `v1=`. מוסיפים גם תנאי שהזמן
  ב-`X-ViperFleet-Timestamp` לא ישן מחמש דקות.
- **Zapier:** הטריגר הוא **Catch Raw Hook** (במקום Catch Hook), כדי לקבל את הגוף הגולמי
  (`raw_body`) ואת הכותרות. אחריו צעד **Code by Zapier** (JavaScript), שממפים אליו את
  `raw_body` כ-body, את שתי הכותרות ואת הסוד:

```js
const crypto = require('crypto');
const expected = crypto
  .createHmac('sha256', inputData.secret)
  .update(`${inputData.timestamp}.${inputData.body}`)
  .digest('hex');
const fresh = Math.abs(Date.now() / 1000 - Number(inputData.timestamp)) < 300;
return { valid: fresh && `v1=${expected}` === inputData.signature, ...JSON.parse(inputData.body) };
```

אחריו Filter על `valid` = true. את הסוד שומרים כמשתנה של ה-Zap, לא בקוד.

## הגבלות

- עד 20 משלוחים לדקה לכל ארגון. אם יש יותר, הם ממתינים בתור ולא הולכים לאיבוד.
- כתובת https בלבד, בפורט 443, לשם ציבורי.
- משלוחים נשמרים 30 יום. כשלון נרשם רק לפי סוגו (timeout, network, http 4xx/5xx).

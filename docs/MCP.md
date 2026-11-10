# חיבור MCP: שואלים את הצי מתוך ה-AI של הלקוח (AI-07)

ה-API הציבורי (INT-01) זמין גם כשרת MCP. כך לקוח יכול לשאול את Claude, ChatGPT או Copilot שאלות כמו
"אילו רכבים עם טסט שפג החודש?" או "כמה הוצאנו על דלק באוקטובר?", והעוזר שולף את התשובה מהצי.

## מה יש

- כתובת: `POST <כתובת ה-API>/v1/mcp`, למשל
  `https://viper-fleet-api.example.co.il/functions/v1/public-api/v1/mcp`.
- פרוטוקול: MCP ב-Streamable HTTP, בלי סשן. כל בקשה היא הודעת JSON-RPC אחת, והתשובה JSON.
  גרסאות נתמכות: `2025-06-18`, `2025-03-26`, `2024-11-05`.
- כלים: כלי קריאה אחד לכל משאב של ה-API: `list_vehicles`, `list_drivers`, `list_assignments`,
  `list_documents`, `list_work_orders`, `list_issues`, `list_inspections`, `list_incidents`, `list_fuel`,
  `list_expenses`, `list_monthly_costs`, `list_violations`, `list_dispatch_jobs`. כל כלי מקבל `limit`,
  `cursor` ו-`updated_since`, כמו ב-REST.
- הרשאות: אותו מפתח API (`Authorization: Bearer vf_…`) ואותן בדיקות במסד (`api_authorize`, `api_v1_rows`).
  הכלים קוראים בלבד, רק את הארגון של המפתח, ובאותה מגבלת קצב. אין בהם תעודות זהות, טלפונים או מיקומים.
- הקוד: `supabase/functions/public-api/mcp.js` (הלוגיקה) ו-`core.js` (החיבור לבקשה). הבדיקות ב-
  `__tests__/mcp.test.js`.

## חיבור

מפתח יוצרים ב"צי ← חיבורים ← מפתחות API" (הרשאת קריאה מספיקה).

**Claude Code:**

```bash
claude mcp add --transport http viper-fleet https://<כתובת ה-API>/v1/mcp --header "Authorization: Bearer vf_..."
```

**כל לקוח MCP שתומך בשרת HTTP עם כותרות** (למשל Cursor ו-VS Code): סוג `http`, הכתובת למעלה, והכותרת
`Authorization: Bearer vf_…`. לקוח שמריץ רק שרתים מקומיים מתחבר דרך גשר כמו `mcp-remote`.

**בדיקה ידנית:**

```bash
curl -s https://<כתובת ה-API>/v1/mcp -H "Authorization: Bearer vf_..." -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## מה עוד לא

- **OAuth.** מחברים מותאמים אישית ב-claude.ai וב-ChatGPT דורשים התחברות ב-OAuth ולא מפתח קבוע. לשם כך
  צריך שרת הרשאות (למשל Supabase Auth כ-OAuth provider) ומסך הסכמה שמנפיק מפתח לארגון. זה שלב נפרד
  ומחכה להחלטה של הבעלים.
- **כתיבה.** הכלים קוראים בלבד. פתיחת הזמנת עבודה או משימה מתוך העוזר תבוא כשה-API יקבל כתיבה.
- **מיקום חי.** המיקומים נשארים ב-Traccar ולא עוברים דרך ה-API, בכוונה (פרטיות הנהגים, SEC-12).
